import requests
import sys
import json
from datetime import datetime

class ForecastingAPITester:
    def __init__(self, base_url="http://localhost:8001"):
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
            else:
                print(f"❌ Failed - Invalid response or content type")
                
            return success
            
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False

def main():
    # Setup
    tester = ForecastingAPITester("http://localhost:8001")
    
    print("🚀 Starting Forecasting API Tests")
    print("=" * 50)

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

    # Test 4: Generate Forecasts
    forecast_success, forecast_data = tester.test_generate_forecasts()
    if not forecast_success:
        print("❌ Forecast generation failed")
        return 1

    # Test 5: Combined Data (after forecast generation)
    combined_success, combined_data = tester.test_combined_data()

    # Test 6: Lineup Data (get first available lineup)
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

    # Test 7: CSV Export
    csv_success = tester.test_csv_export()

    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print("⚠️  Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())