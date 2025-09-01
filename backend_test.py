import requests
import sys
import json
from datetime import datetime

class ForecastingAPITester:
    def __init__(self, base_url="https://805b056d-d979-4878-b784-e89e50fd864c.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.forecast_generated = False

    def run_test(self, name, method, endpoint, expected_status, data=None, check_response=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=30)

            print(f"   Status Code: {response.status_code}")
            
            success = response.status_code == expected_status
            
            if success:
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    
                    # Additional response validation if provided
                    if check_response and callable(check_response):
                        success = check_response(response_data)
                        
                except Exception as e:
                    print(f"   Response parsing error: {e}")
                    if expected_status == 200:
                        success = False
                
                if success:
                    self.tests_passed += 1
                    print(f"✅ Passed")
                else:
                    print(f"❌ Failed - Response validation failed")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_response = response.json()
                    print(f"   Error: {error_response}")
                except:
                    print(f"   Error: {response.text}")

            return success, response.json() if success else {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health check endpoint"""
        def validate_health(data):
            return data.get('status') == 'healthy'
            
        success, response = self.run_test(
            "Health Check",
            "GET",
            "api/health",
            200,
            check_response=validate_health
        )
        return success

    def test_data_summary(self):
        """Test data summary endpoint"""
        def validate_summary(data):
            required_keys = ['sample_data', 'plan_data']
            if not all(key in data for key in required_keys):
                return False
            
            sample_data = data['sample_data']
            plan_data = data['plan_data']
            
            # Check if sample_data has required fields
            sample_required = ['rows', 'date_range', 'unique_lineups', 'unique_profiles']
            plan_required = ['rows', 'date_range', 'unique_lineups']
            
            return (all(key in sample_data for key in sample_required) and
                    all(key in plan_data for key in plan_required) and
                    sample_data['rows'] > 0 and plan_data['rows'] > 0)
            
        success, response = self.run_test(
            "Data Summary",
            "GET",
            "api/data/summary",
            200,
            check_response=validate_summary
        )
        return success, response

    def test_hierarchy(self):
        """Test hierarchy endpoint"""
        def validate_hierarchy(data):
            # Should return a nested dictionary structure
            return isinstance(data, dict) and len(data) > 0
            
        success, response = self.run_test(
            "Data Hierarchy",
            "GET",
            "api/data/hierarchy",
            200,
            check_response=validate_hierarchy
        )
        return success, response

    def test_generate_forecasts(self):
        """Test forecast generation"""
        def validate_forecast_generation(data):
            required_keys = ['message', 'total_forecast_points', 'unique_lineups', 'forecast_period']
            return (all(key in data for key in required_keys) and
                    data['total_forecast_points'] > 0 and
                    data['unique_lineups'] > 0)
            
        success, response = self.run_test(
            "Generate Forecasts",
            "POST",
            "api/forecast/generate",
            200,
            check_response=validate_forecast_generation
        )
        
        if success:
            self.forecast_generated = True
            
        return success, response

    def test_combined_data(self):
        """Test combined data endpoint (requires forecasts to be generated first)"""
        if not self.forecast_generated:
            print("⚠️  Skipping combined data test - forecasts not generated")
            return False, {}
            
        def validate_combined_data(data):
            required_keys = ['data', 'total_rows']
            if not all(key in data for key in required_keys):
                return False
                
            # Check if data array has items with expected structure
            if len(data['data']) > 0:
                sample_item = data['data'][0]
                expected_columns = ['Profile', 'Lineup', 'DATE', 'Actual', 'Plan', 'Forecast']
                return any(col in sample_item for col in expected_columns)
            return True
            
        success, response = self.run_test(
            "Combined Data",
            "GET",
            "api/data/combined",
            200,
            check_response=validate_combined_data
        )
        return success, response

    def test_lineup_data(self, lineup_name):
        """Test lineup-specific data endpoint"""
        if not self.forecast_generated:
            print("⚠️  Skipping lineup data test - forecasts not generated")
            return False, {}
            
        def validate_lineup_data(data):
            required_keys = ['lineup', 'data', 'total_rows']
            return (all(key in data for key in required_keys) and
                    data['lineup'] == lineup_name and
                    len(data['data']) > 0)
            
        success, response = self.run_test(
            f"Lineup Data ({lineup_name})",
            "GET",
            f"api/data/lineup/{lineup_name}",
            200,
            check_response=validate_lineup_data
        )
        return success, response

    def test_csv_export(self):
        """Test CSV export endpoint"""
        if not self.forecast_generated:
            print("⚠️  Skipping CSV export test - forecasts not generated")
            return False
            
        url = f"{self.base_url}/api/export/csv"
        self.tests_run += 1
        print(f"\n🔍 Testing CSV Export...")
        print(f"   URL: {url}")
        
        try:
            response = requests.get(url, timeout=30)
            print(f"   Status Code: {response.status_code}")
            
            success = (response.status_code == 200 and 
                      'text/csv' in response.headers.get('content-type', ''))
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - CSV file received ({len(response.content)} bytes)")
                # Check if CSV contains Synthetic_Actual column
                csv_content = response.content.decode('utf-8')
                if 'Synthetic_Actual' in csv_content:
                    print("   ✅ CSV contains Synthetic_Actual column")
                else:
                    print("   ⚠️  CSV missing Synthetic_Actual column")
            else:
                print(f"❌ Failed - Invalid response or content type")
                
            return success
            
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False

    def test_filtered_data(self):
        """Test NEW filtered data endpoint with hierarchy parameters"""
        if not self.forecast_generated:
            print("⚠️  Skipping filtered data test - forecasts not generated")
            return False, {}
            
        def validate_filtered_data(data):
            required_keys = ['data', 'total_rows', 'filters_applied']
            return all(key in data for key in required_keys)
            
        success, response = self.run_test(
            "Filtered Data (NEW)",
            "GET",
            "api/data/filtered",
            200,
            check_response=validate_filtered_data
        )
        return success, response

    def test_yearly_summary(self):
        """Test NEW yearly summary endpoint for visualization"""
        if not self.forecast_generated:
            print("⚠️  Skipping yearly summary test - forecasts not generated")
            return False, {}
            
        def validate_yearly_summary(data):
            required_keys = ['yearly_data', 'available_years']
            if not all(key in data for key in required_keys):
                return False
            
            # Check if yearly_data has proper structure
            if len(data['yearly_data']) > 0:
                year_data = data['yearly_data'][0]
                year_required = ['year', 'months']
                if not all(key in year_data for key in year_required):
                    return False
                
                # Check months structure
                if len(year_data['months']) > 0:
                    month_data = year_data['months'][0]
                    month_required = ['month', 'month_name', 'actual', 'plan', 'forecast', 'synthetic_actual']
                    return all(key in month_data for key in month_required)
            
            return True
            
        success, response = self.run_test(
            "Yearly Summary (NEW)",
            "GET",
            "api/data/yearly-summary",
            200,
            check_response=validate_yearly_summary
        )
        return success, response

    def test_hierarchy_options(self):
        """Test NEW hierarchy options endpoint for filter dropdowns"""
        if not self.forecast_generated:
            print("⚠️  Skipping hierarchy options test - forecasts not generated")
            return False, {}
            
        def validate_hierarchy_options(data):
            required_keys = ['profiles', 'line_items', 'bodies', 'sites', 'lineups']
            if not all(key in data for key in required_keys):
                return False
            
            # Check if all are lists with content
            return all(isinstance(data[key], list) and len(data[key]) > 0 for key in required_keys)
            
        success, response = self.run_test(
            "Hierarchy Options (NEW)",
            "GET",
            "api/data/hierarchy-options",
            200,
            check_response=validate_hierarchy_options
        )
        return success, response

    def test_filtered_data_with_params(self, profile=None, line_item=None, body=None, site=None, lineup=None):
        """Test filtered data with specific hierarchy parameters"""
        if not self.forecast_generated:
            print("⚠️  Skipping filtered data with params test - forecasts not generated")
            return False, {}
        
        params = []
        if profile: params.append(f"profile={profile}")
        if line_item: params.append(f"line_item={line_item}")
        if body: params.append(f"body={body}")
        if site: params.append(f"site={site}")
        if lineup: params.append(f"lineup={lineup}")
        
        query_string = "&".join(params)
        endpoint = f"api/data/filtered?{query_string}" if query_string else "api/data/filtered"
        
        def validate_filtered_data_with_params(data):
            required_keys = ['data', 'total_rows', 'filters_applied']
            if not all(key in data for key in required_keys):
                return False
            
            # Validate filters_applied matches what we sent
            filters = data['filters_applied']
            if profile and filters.get('profile') != profile:
                return False
            if line_item and filters.get('line_item') != line_item:
                return False
            if body and filters.get('body') != body:
                return False
            if site and filters.get('site') != site:
                return False
            if lineup and filters.get('lineup') != lineup:
                return False
                
            return True
            
        success, response = self.run_test(
            f"Filtered Data with Params ({query_string})",
            "GET",
            endpoint,
            200,
            check_response=validate_filtered_data_with_params
        )
        return success, response

    def test_synthetic_actuals_validation(self, combined_data):
        """Validate that synthetic actuals are properly calculated (seasonal averages)"""
        print(f"\n🔍 Validating Synthetic Actuals Calculation...")
        
        if not combined_data or 'data' not in combined_data:
            print("❌ No combined data available for validation")
            return False
        
        data = combined_data['data']
        
        # Group data by lineup and check synthetic actuals
        lineup_data = {}
        for item in data:
            lineup = item.get('Lineup')
            if not lineup:
                continue
                
            if lineup not in lineup_data:
                lineup_data[lineup] = {'historical': [], 'synthetic': []}
            
            date_str = item.get('DATE', '')
            if date_str.startswith('2025') and item.get('Synthetic_Actual') is not None:
                lineup_data[lineup]['synthetic'].append({
                    'month': int(date_str.split('-')[1]),
                    'value': item['Synthetic_Actual']
                })
            elif not date_str.startswith('2025') and item.get('Actual') is not None:
                lineup_data[lineup]['historical'].append({
                    'month': int(date_str.split('-')[1]),
                    'value': item['Actual']
                })
        
        validation_passed = True
        for lineup, data_dict in lineup_data.items():
            if not data_dict['synthetic'] or not data_dict['historical']:
                continue
                
            print(f"   Checking lineup: {lineup}")
            
            # Check if synthetic actuals make sense (should be seasonal averages)
            for synthetic_item in data_dict['synthetic']:
                month = synthetic_item['month']
                synthetic_value = synthetic_item['value']
                
                # Get historical values for the same month
                historical_month_values = [
                    h['value'] for h in data_dict['historical'] 
                    if h['month'] == month
                ]
                
                if historical_month_values:
                    expected_avg = sum(historical_month_values) / len(historical_month_values)
                    # Allow for small floating point differences
                    if abs(synthetic_value - expected_avg) > 0.01:
                        print(f"   ⚠️  Month {month}: Synthetic={synthetic_value:.2f}, Expected Avg={expected_avg:.2f}")
                        validation_passed = False
                    else:
                        print(f"   ✅ Month {month}: Synthetic={synthetic_value:.2f} matches expected average")
        
        if validation_passed:
            print("✅ Synthetic actuals validation passed")
        else:
            print("❌ Synthetic actuals validation failed")
            
        return validation_passed

def main():
    # Setup
    tester = ForecastingAPITester("https://805b056d-d979-4878-b784-e89e50fd864c.preview.emergentagent.com")
    
    print("🚀 Starting Enhanced Forecasting API Tests")
    print("=" * 60)

    # Test 1: Health Check
    if not tester.test_health_check():
        print("❌ Health check failed, stopping tests")
        return 1

    # Test 2: Data Summary
    summary_success, summary_data = tester.test_data_summary()
    if not summary_success:
        print("❌ Data summary failed, stopping tests")
        return 1

    # Test 3: Hierarchy
    hierarchy_success, hierarchy_data = tester.test_hierarchy()
    if not hierarchy_success:
        print("❌ Hierarchy test failed")

    # Test 4: Generate Forecasts (This creates synthetic actuals)
    forecast_success, forecast_data = tester.test_generate_forecasts()
    if not forecast_success:
        print("❌ Forecast generation failed")
        return 1

    # Test 5: Combined Data (after forecast generation)
    combined_success, combined_data = tester.test_combined_data()

    # Test 6: NEW - Hierarchy Options for filter dropdowns
    hierarchy_options_success, hierarchy_options_data = tester.test_hierarchy_options()

    # Test 7: NEW - Yearly Summary for visualization
    yearly_summary_success, yearly_summary_data = tester.test_yearly_summary()

    # Test 8: NEW - Filtered Data (no params)
    filtered_data_success, filtered_data_response = tester.test_filtered_data()

    # Test 9: NEW - Filtered Data with specific parameters
    if hierarchy_options_success and hierarchy_options_data:
        # Test with first available options
        profiles = hierarchy_options_data.get('profiles', [])
        lineups = hierarchy_options_data.get('lineups', [])
        
        if profiles:
            profile_filter_success, _ = tester.test_filtered_data_with_params(profile=profiles[0])
        
        if lineups:
            lineup_filter_success, _ = tester.test_filtered_data_with_params(lineup=lineups[0])

    # Test 10: Lineup Data (get first available lineup)
    lineup_name = None
    if hierarchy_success and hierarchy_data:
        # Extract first lineup from hierarchy
        for profile in hierarchy_data:
            for line_item in hierarchy_data[profile]:
                for site in hierarchy_data[profile][line_item]:
                    if hierarchy_data[profile][line_item][site]:
                        lineup_name = hierarchy_data[profile][line_item][site][0]
                        break
                if lineup_name:
                    break
            if lineup_name:
                break
    
    if lineup_name:
        lineup_success, lineup_data = tester.test_lineup_data(lineup_name)
    else:
        print("⚠️  No lineup found for testing")

    # Test 11: Synthetic Actuals Validation
    if combined_success and combined_data:
        synthetic_validation = tester.test_synthetic_actuals_validation(combined_data)

    # Test 12: CSV Export (should include Synthetic_Actual column)
    csv_success = tester.test_csv_export()

    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    # Summary of key features tested
    print("\n🔍 Key Features Tested:")
    print(f"   ✅ Health Check: {'✅' if tester.test_health_check else '❌'}")
    print(f"   ✅ Data Summary: {'✅' if summary_success else '❌'}")
    print(f"   ✅ Hierarchy Structure: {'✅' if hierarchy_success else '❌'}")
    print(f"   ✅ Forecast Generation: {'✅' if forecast_success else '❌'}")
    print(f"   ✅ Combined Data: {'✅' if combined_success else '❌'}")
    print(f"   🆕 Hierarchy Options (NEW): {'✅' if hierarchy_options_success else '❌'}")
    print(f"   🆕 Yearly Summary (NEW): {'✅' if yearly_summary_success else '❌'}")
    print(f"   🆕 Filtered Data (NEW): {'✅' if filtered_data_success else '❌'}")
    print(f"   ✅ Lineup Data: {'✅' if lineup_name and lineup_success else '❌'}")
    print(f"   ✅ CSV Export with Synthetic_Actual: {'✅' if csv_success else '❌'}")
    
    if tester.tests_passed == tester.tests_run:
        print("\n🎉 All API tests passed!")
        print("✅ Backend is ready for frontend testing")
        return 0
    else:
        print(f"\n⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        print("❌ Fix backend issues before proceeding to frontend testing")
        return 1

if __name__ == "__main__":
    sys.exit(main())