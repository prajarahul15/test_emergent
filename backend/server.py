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
from typing import Dict, List, Any, Tuple
import json
import tempfile
from sklearn.metrics import mean_absolute_percentage_error, mean_squared_error
import warnings
warnings.filterwarnings('ignore')

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
        
        # Remove empty rows
        sample_data = sample_data.dropna(subset=['Profile', 'Lineup', 'DATE', 'Actual'])
        plan_data = plan_data.dropna(subset=['Profile', 'Lineup', 'DATE', 'Plan'])
        
        # Convert DATE column to datetime
        sample_data['DATE'] = pd.to_datetime(sample_data['DATE'], format='%d-%m-%Y')
        plan_data['DATE'] = pd.to_datetime(plan_data['DATE'], format='%d-%m-%Y')
        
        print(f"Default data loaded successfully - Sample: {len(sample_data)} rows, Plan: {len(plan_data)} rows")
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

def generate_forecast_with_confidence(data: pd.DataFrame, lineup: str, periods: int = 12) -> Tuple[List[float], List[float], List[float], Dict]:
    """Generate forecast with confidence intervals and accuracy metrics"""
    lineup_data = data[data['Lineup'] == lineup].copy()
    lineup_data = lineup_data.sort_values('DATE')
    
    if len(lineup_data) < 6:
        # If not enough data, use simple mean with basic confidence
        mean_value = lineup_data['Actual'].mean()
        std_value = lineup_data['Actual'].std() if len(lineup_data) > 1 else mean_value * 0.1
        
        forecasts = [float(mean_value)] * periods
        lower_bounds = [max(0, float(mean_value - 1.96 * std_value))] * periods
        upper_bounds = [float(mean_value + 1.96 * std_value)] * periods
        
        return forecasts, lower_bounds, upper_bounds, {
            'model_type': 'simple_mean',
            'accuracy_metrics': {'rmse': std_value, 'mape': 0.1},
            'risk_level': 'high'
        }
    
    # Split data for training and testing (80-20 split)
    split_point = int(len(lineup_data) * 0.8)
    train_data = lineup_data.iloc[:split_point]
    test_data = lineup_data.iloc[split_point:]
    
    # Model fitting and accuracy calculation
    accuracy_metrics = {}
    risk_level = 'medium'
    model_type = 'exponential_smoothing'
    
    try:
        # Use ETS (Exponential Smoothing) model
        model = ETSModel(train_data['Actual'].values, trend='add', seasonal=None)
        fitted_model = model.fit()
        
        # Generate test forecasts for accuracy calculation
        if len(test_data) > 0:
            test_forecast = fitted_model.forecast(len(test_data))
            test_actual = test_data['Actual'].values
            
            # Calculate accuracy metrics
            rmse = np.sqrt(mean_squared_error(test_actual, test_forecast))
            mape = mean_absolute_percentage_error(test_actual, test_forecast)
            
            accuracy_metrics = {
                'rmse': float(rmse),
                'mape': float(mape),
                'test_points': len(test_data)
            }
            
            # Determine risk level based on MAPE
            if mape < 0.1:  # Less than 10%
                risk_level = 'low'
            elif mape < 0.2:  # Less than 20%
                risk_level = 'medium'
            else:
                risk_level = 'high'
        
        # Generate actual forecasts
        full_model = ETSModel(lineup_data['Actual'].values, trend='add', seasonal=None)
        full_fitted = full_model.fit()
        forecasts = full_fitted.forecast(periods)
        
        # Generate confidence intervals (approximate)
        forecast_errors = fitted_model.resid if hasattr(fitted_model, 'resid') else np.array([0])
        std_error = np.std(forecast_errors) if len(forecast_errors) > 1 else np.std(lineup_data['Actual']) * 0.1
        
        forecasts_clean = [max(0, float(f)) for f in forecasts]
        lower_bounds = [max(0, float(f - 1.96 * std_error)) for f in forecasts]
        upper_bounds = [float(f + 1.96 * std_error) for f in forecasts]
        
        return forecasts_clean, lower_bounds, upper_bounds, {
            'model_type': model_type,
            'accuracy_metrics': accuracy_metrics,
            'risk_level': risk_level
        }
        
    except Exception as e:
        print(f"ETS model failed for {lineup}, trying ARIMA: {e}")
        
        try:
            # Fallback to ARIMA
            model = ARIMA(train_data['Actual'].values, order=(1,1,1))
            fitted_model = model.fit()
            model_type = 'arima'
            
            # Test accuracy if test data available
            if len(test_data) > 0:
                test_forecast = fitted_model.forecast(steps=len(test_data))
                test_actual = test_data['Actual'].values
                
                rmse = np.sqrt(mean_squared_error(test_actual, test_forecast))
                mape = mean_absolute_percentage_error(test_actual, test_forecast)
                
                accuracy_metrics = {
                    'rmse': float(rmse),
                    'mape': float(mape),
                    'test_points': len(test_data)
                }
                
                risk_level = 'low' if mape < 0.1 else 'medium' if mape < 0.2 else 'high'
            
            # Generate forecasts
            full_model = ARIMA(lineup_data['Actual'].values, order=(1,1,1))
            full_fitted = full_model.fit()
            forecasts = full_fitted.forecast(steps=periods)
            
            # Confidence intervals
            std_error = np.std(lineup_data['Actual']) * 0.15
            forecasts_clean = [max(0, float(f)) for f in forecasts]
            lower_bounds = [max(0, float(f - 1.96 * std_error)) for f in forecasts]
            upper_bounds = [float(f + 1.96 * std_error) for f in forecasts]
            
            return forecasts_clean, lower_bounds, upper_bounds, {
                'model_type': model_type,
                'accuracy_metrics': accuracy_metrics,
                'risk_level': risk_level
            }
            
        except Exception as e2:
            print(f"ARIMA also failed for {lineup}, using simple average: {e2}")
            
            # Final fallback
            mean_value = lineup_data['Actual'].mean()
            std_value = lineup_data['Actual'].std()
            
            forecasts = [float(mean_value)] * periods
            lower_bounds = [max(0, float(mean_value - 1.96 * std_value))] * periods
            upper_bounds = [float(mean_value + 1.96 * std_value)] * periods
            
            return forecasts, lower_bounds, upper_bounds, {
                'model_type': 'simple_mean',
                'accuracy_metrics': {'rmse': float(std_value), 'mape': 0.2},
                'risk_level': 'high'
            }

def generate_seasonal_actuals_for_lineup(data: pd.DataFrame, lineup: str) -> List[float]:
    """Generate seasonal actuals for 2025 based on historical monthly averages"""
    lineup_data = data[data['Lineup'] == lineup].copy()
    lineup_data = lineup_data.sort_values('DATE')
    lineup_data['Month'] = lineup_data['DATE'].dt.month
    
    # Calculate monthly averages from historical data
    monthly_averages = {}
    for month in range(1, 13):
        month_data = lineup_data[lineup_data['Month'] == month]['Actual']
        if len(month_data) > 0:
            monthly_averages[month] = float(month_data.mean())
        else:
            # If no data for this month, use overall average
            monthly_averages[month] = float(lineup_data['Actual'].mean())
    
    # Return 12 months of seasonal actuals
    return [monthly_averages[month] for month in range(1, 13)]

@app.post("/api/forecast/generate")
def generate_forecasts():
    """Generate forecasts and synthetic actuals for all lineups"""
    global sample_data, plan_data, combined_data
    
    if sample_data is None:
        raise HTTPException(status_code=404, detail="Sample data not loaded")
    
    try:
        # Get unique lineups from sample data
        lineups = sample_data['Lineup'].unique()
        lineups = [lineup for lineup in lineups if pd.notna(lineup)]  # Remove NaN values
        
        print(f"Processing forecasts for {len(lineups)} lineups: {lineups}")
        
        # Generate forecasts and synthetic actuals for each lineup
        forecast_results = []
        synthetic_actual_results = []
        
        for lineup in lineups:
            try:
                # Get lineup sample data for metadata
                lineup_rows = sample_data[sample_data['Lineup'] == lineup]
                if len(lineup_rows) == 0:
                    print(f"No data found for lineup: {lineup}")
                    continue
                    
                lineup_sample = lineup_rows.iloc[0]
                forecasts = generate_forecast_for_lineup(sample_data, lineup, 12)
                synthetic_actuals = generate_seasonal_actuals_for_lineup(sample_data, lineup)
                
                print(f"Generated {len(forecasts)} forecasts and {len(synthetic_actuals)} synthetic actuals for lineup: {lineup}")
                
                # Create forecast data for each month of 2025
                for i, (forecast_value, synthetic_actual) in enumerate(zip(forecasts, synthetic_actuals)):
                    forecast_date = datetime(2025, i+1, 1)
                    
                    # Create forecast row
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
                        'Forecast': forecast_value,
                        'Synthetic_Actual': synthetic_actual
                    }
                    forecast_results.append(forecast_row)
                    
            except Exception as e:
                print(f"Error processing lineup {lineup}: {e}")
                continue
        
        if not forecast_results:
            raise HTTPException(status_code=500, detail="No forecasts could be generated")
        
        # Create combined dataset
        forecast_df = pd.DataFrame(forecast_results)
        
        # Prepare sample data with additional columns
        sample_with_cols = sample_data.copy()
        sample_with_cols['Plan'] = np.nan
        sample_with_cols['Forecast'] = np.nan
        sample_with_cols['Synthetic_Actual'] = np.nan
        
        # Prepare plan data with additional columns  
        plan_with_cols = plan_data.copy()
        plan_with_cols['Actual'] = np.nan
        plan_with_cols['Forecast'] = np.nan
        plan_with_cols['Synthetic_Actual'] = np.nan
        # Make sure plan data has the right column name
        if 'Plan' not in plan_with_cols.columns:
            plan_with_cols['Plan'] = plan_with_cols.get('Plan', np.nan)
        
        # Combine all data
        combined_data = pd.concat([sample_with_cols, plan_with_cols, forecast_df], ignore_index=True)
        combined_data = combined_data.sort_values(['Lineup', 'DATE']).reset_index(drop=True)
        
        return {
            "message": "Forecasts and synthetic actuals generated successfully",
            "total_forecast_points": len(forecast_df),
            "unique_lineups": len(lineups),
            "forecast_period": "2025 (12 months)",
            "synthetic_actuals_generated": True
        }
        
    except Exception as e:
        print(f"Detailed error: {e}")
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
    
    # Replace NaN values with None for JSON serialization
    data_dict = data_dict.replace({np.nan: None})
    
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
    
    # Replace NaN values with None for JSON serialization
    lineup_data = lineup_data.replace({np.nan: None})
    
    if len(lineup_data) == 0:
        raise HTTPException(status_code=404, detail=f"No data found for lineup: {lineup}")
    
    return {
        "lineup": lineup,
        "data": lineup_data.to_dict('records'),
        "total_rows": len(lineup_data)
    }

@app.get("/api/data/filtered")
def get_filtered_data(
    profile: str = None,
    line_item: str = None, 
    body: str = None,
    site: str = None,
    lineup: str = None
):
    """Get data filtered by hierarchical levels"""
    global combined_data
    
    if combined_data is None:
        raise HTTPException(status_code=404, detail="Combined data not available. Generate forecasts first.")
    
    filtered_data = combined_data.copy()
    
    # Apply filters
    if profile:
        filtered_data = filtered_data[filtered_data['Profile'] == profile]
    if line_item:
        filtered_data = filtered_data[filtered_data['Line_Item'] == line_item]
    if body:
        filtered_data = filtered_data[filtered_data['Body'] == body]
    if site:
        filtered_data = filtered_data[filtered_data['Site'] == site]
    if lineup:
        filtered_data = filtered_data[filtered_data['Lineup'] == lineup]
    
    # Convert to JSON-serializable format
    filtered_data['DATE'] = filtered_data['DATE'].dt.strftime('%Y-%m-%d')
    filtered_data = filtered_data.replace({np.nan: None})
    
    return {
        "data": filtered_data.to_dict('records'),
        "total_rows": len(filtered_data),
        "filters_applied": {
            "profile": profile,
            "line_item": line_item,
            "body": body,
            "site": site,
            "lineup": lineup
        }
    }

@app.get("/api/data/yearly-summary")
def get_yearly_summary():
    """Get year-wise summary data for visualization"""
    global combined_data
    
    if combined_data is None:
        raise HTTPException(status_code=404, detail="Combined data not available. Generate forecasts first.")
    
    # Add year and month columns
    data_with_year = combined_data.copy()
    data_with_year['Year'] = data_with_year['DATE'].dt.year
    data_with_year['Month'] = data_with_year['DATE'].dt.month
    
    # Group by year and month, sum all numeric values
    yearly_summary = []
    
    for year in sorted(data_with_year['Year'].unique()):
        year_data = data_with_year[data_with_year['Year'] == year]
        monthly_data = []
        
        for month in range(1, 13):
            month_data = year_data[year_data['Month'] == month]
            
            monthly_summary = {
                'month': month,
                'month_name': datetime(year, month, 1).strftime('%b'),
                'actual': float(month_data['Actual'].sum()) if not month_data['Actual'].isna().all() else None,
                'plan': float(month_data['Plan'].sum()) if not month_data['Plan'].isna().all() else None,
                'forecast': float(month_data['Forecast'].sum()) if not month_data['Forecast'].isna().all() else None,
                'synthetic_actual': float(month_data['Synthetic_Actual'].sum()) if 'Synthetic_Actual' in month_data.columns and not month_data['Synthetic_Actual'].isna().all() else None
            }
            monthly_data.append(monthly_summary)
        
        yearly_summary.append({
            'year': int(year),
            'months': monthly_data
        })
    
    return {
        "yearly_data": yearly_summary,
        "available_years": sorted([int(year) for year in data_with_year['Year'].unique()])
    }

@app.get("/api/data/hierarchy-options")
def get_hierarchy_options():
    """Get available options for each hierarchy level"""
    global combined_data
    
    if combined_data is None:
        raise HTTPException(status_code=404, detail="Combined data not available. Generate forecasts first.")
    
    options = {
        "profiles": sorted(combined_data['Profile'].dropna().unique().tolist()),
        "line_items": sorted(combined_data['Line_Item'].dropna().unique().tolist()),
        "bodies": sorted(combined_data['Body'].dropna().unique().tolist()),
        "sites": sorted(combined_data['Site'].dropna().unique().tolist()),
        "lineups": sorted(combined_data['Lineup'].dropna().unique().tolist())
    }
    
    return options

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