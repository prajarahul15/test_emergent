from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import pandas as pd
import numpy as np
from statsmodels.tsa.exponential_smoothing.ets import ETSModel
from statsmodels.tsa.arima.model import ARIMA
import io
import os
from datetime import datetime, timedelta
from typing import Dict, List, Any
import json
import tempfile

app = FastAPI(title="Forecasting Application API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables to store data
sample_data = None
plan_data = None
combined_data = None

def load_default_data():
    """Load default CSV files on startup"""
    global sample_data, plan_data
    try:
        sample_data = pd.read_csv('/app/Sample_data_N.csv')
        plan_data = pd.read_csv('/app/Plan Number.csv')
        
        # Convert DATE column to datetime
        sample_data['DATE'] = pd.to_datetime(sample_data['DATE'], format='%d-%m-%Y')
        plan_data['DATE'] = pd.to_datetime(plan_data['DATE'], format='%d-%m-%Y')
        
        print("Default data loaded successfully")
    except Exception as e:
        print(f"Error loading default data: {e}")

@app.on_event("startup")
async def startup_event():
    load_default_data()

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "message": "Forecasting API is running"}

@app.get("/api/data/summary")
def get_data_summary():
    """Get summary of loaded data"""
    global sample_data, plan_data
    
    if sample_data is None or plan_data is None:
        raise HTTPException(status_code=404, detail="Data not loaded")
    
    sample_summary = {
        "rows": len(sample_data),
        "date_range": {
            "start": sample_data['DATE'].min().strftime('%Y-%m-%d'),
            "end": sample_data['DATE'].max().strftime('%Y-%m-%d')
        },
        "unique_lineups": sample_data['Lineup'].nunique(),
        "unique_profiles": sample_data['Profile'].nunique()
    }
    
    plan_summary = {
        "rows": len(plan_data),
        "date_range": {
            "start": plan_data['DATE'].min().strftime('%Y-%m-%d'),
            "end": plan_data['DATE'].max().strftime('%Y-%m-%d')
        },
        "unique_lineups": plan_data['Lineup'].nunique()
    }
    
    return {
        "sample_data": sample_summary,
        "plan_data": plan_summary
    }

@app.get("/api/data/hierarchy")
def get_hierarchy():
    """Get hierarchical structure of data"""
    global sample_data
    
    if sample_data is None:
        raise HTTPException(status_code=404, detail="Sample data not loaded")
    
    hierarchy = {}
    for _, row in sample_data.iterrows():
        profile = row['Profile']
        line_item = row['Line_Item']
        site = row['Site']
        lineup = row['Lineup']
        
        if profile not in hierarchy:
            hierarchy[profile] = {}
        if line_item not in hierarchy[profile]:
            hierarchy[profile][line_item] = {}
        if site not in hierarchy[profile][line_item]:
            hierarchy[profile][line_item][site] = []
        if lineup not in hierarchy[profile][line_item][site]:
            hierarchy[profile][line_item][site].append(lineup)
    
    return hierarchy

def generate_forecast_for_lineup(data: pd.DataFrame, lineup: str, periods: int = 12) -> List[float]:
    """Generate forecast for a specific lineup using exponential smoothing"""
    lineup_data = data[data['Lineup'] == lineup].copy()
    lineup_data = lineup_data.sort_values('DATE')
    
    if len(lineup_data) < 3:
        # If not enough data, use simple mean
        mean_value = lineup_data['Actual'].mean()
        return [float(mean_value)] * periods
    
    try:
        # Use ETS (Exponential Smoothing) model
        model = ETSModel(lineup_data['Actual'].values, trend='add', seasonal=None)
        fitted_model = model.fit()
        forecast = fitted_model.forecast(periods)
        return [max(0, float(x)) for x in forecast]  # Ensure non-negative values
    except:
        try:
            # Fallback to ARIMA
            model = ARIMA(lineup_data['Actual'].values, order=(1,1,1))
            fitted_model = model.fit()
            forecast = fitted_model.forecast(steps=periods)
            return [max(0, float(x)) for x in forecast]
        except:
            # Final fallback to simple moving average
            window = min(3, len(lineup_data))
            mean_value = lineup_data['Actual'].tail(window).mean()
            return [float(mean_value)] * periods

@app.post("/api/forecast/generate")
def generate_forecasts():
    """Generate forecasts for all lineups"""
    global sample_data, plan_data, combined_data
    
    if sample_data is None:
        raise HTTPException(status_code=404, detail="Sample data not loaded")
    
    try:
        # Get unique lineups
        lineups = sample_data['Lineup'].unique()
        
        # Generate forecasts for each lineup
        forecast_results = []
        
        for lineup in lineups:
            lineup_sample = sample_data[sample_data['Lineup'] == lineup].iloc[0]
            forecasts = generate_forecast_for_lineup(sample_data, lineup, 12)
            
            # Create forecast data for each month of 2025
            for i, forecast_value in enumerate(forecasts):
                forecast_date = datetime(2025, i+1, 1)
                
                forecast_row = {
                    'Profile': lineup_sample['Profile'],
                    'Line_Item': lineup_sample['Line_Item'],
                    'Budget Unit': lineup_sample['Budget Unit'],
                    'Token': lineup_sample['Token'],
                    'Body': lineup_sample['Body'],
                    'Site': lineup_sample['Site'],
                    'Lineup': lineup,
                    'Institutions': lineup_sample['Institutions'],
                    'DATE': forecast_date,
                    'Actual': np.nan,
                    'Plan': np.nan,
                    'Forecast': forecast_value
                }
                forecast_results.append(forecast_row)
        
        # Create combined dataset
        forecast_df = pd.DataFrame(forecast_results)
        
        # Prepare sample data with additional columns
        sample_with_cols = sample_data.copy()
        sample_with_cols['Plan'] = np.nan
        sample_with_cols['Forecast'] = np.nan
        
        # Prepare plan data with additional columns
        plan_with_cols = plan_data.copy()
        plan_with_cols['Actual'] = np.nan
        plan_with_cols['Forecast'] = np.nan
        plan_with_cols = plan_with_cols.rename(columns={'Plan': 'Plan'})
        
        # Combine all data
        combined_data = pd.concat([sample_with_cols, plan_with_cols, forecast_df], ignore_index=True)
        combined_data = combined_data.sort_values(['Lineup', 'DATE']).reset_index(drop=True)
        
        return {
            "message": "Forecasts generated successfully",
            "total_forecast_points": len(forecast_df),
            "unique_lineups": len(lineups),
            "forecast_period": "2025 (12 months)"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating forecasts: {str(e)}")

@app.get("/api/data/combined")
def get_combined_data():
    """Get combined data with actuals, plans, and forecasts"""
    global combined_data
    
    if combined_data is None:
        raise HTTPException(status_code=404, detail="Combined data not available. Generate forecasts first.")
    
    # Convert to JSON-serializable format
    data_dict = combined_data.copy()
    data_dict['DATE'] = data_dict['DATE'].dt.strftime('%Y-%m-%d')
    
    return {
        "data": data_dict.to_dict('records'),
        "total_rows": len(data_dict)
    }

@app.get("/api/data/lineup/{lineup}")
def get_lineup_data(lineup: str):
    """Get data for a specific lineup"""
    global combined_data
    
    if combined_data is None:
        raise HTTPException(status_code=404, detail="Combined data not available. Generate forecasts first.")
    
    lineup_data = combined_data[combined_data['Lineup'] == lineup].copy()
    lineup_data['DATE'] = lineup_data['DATE'].dt.strftime('%Y-%m-%d')
    
    if len(lineup_data) == 0:
        raise HTTPException(status_code=404, detail=f"No data found for lineup: {lineup}")
    
    return {
        "lineup": lineup,
        "data": lineup_data.to_dict('records'),
        "total_rows": len(lineup_data)
    }

@app.get("/api/export/csv")
def export_combined_csv():
    """Export combined data as CSV"""
    global combined_data
    
    if combined_data is None:
        raise HTTPException(status_code=404, detail="Combined data not available. Generate forecasts first.")
    
    # Create temporary file
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv') as tmp_file:
        combined_data.to_csv(tmp_file.name, index=False)
        return FileResponse(
            tmp_file.name,
            media_type='text/csv',
            filename='forecasting_results.csv'
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)