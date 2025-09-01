import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  BarElement,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { Download, RefreshCw, TrendingUp, Database, Calendar, BarChart3 } from 'lucide-react';
import './App.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function App() {
  const [dataSummary, setDataSummary] = useState(null);
  const [hierarchy, setHierarchy] = useState({});
  const [combinedData, setCombinedData] = useState([]);
  const [selectedLineup, setSelectedLineup] = useState('');
  const [lineupData, setLineupData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [forecastGenerated, setForecastGenerated] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchDataSummary();
    fetchHierarchy();
  }, []);

  const fetchDataSummary = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/data/summary`);
      setDataSummary(response.data);
    } catch (error) {
      console.error('Error fetching data summary:', error);
    }
  };

  const fetchHierarchy = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/data/hierarchy`);
      setHierarchy(response.data);
    } catch (error) {
      console.error('Error fetching hierarchy:', error);
    }
  };

  const generateForecasts = async () => {
    setLoading(true);
    try {
      await axios.post(`${BACKEND_URL}/api/forecast/generate`);
      setForecastGenerated(true);
      fetchCombinedData();
    } catch (error) {
      console.error('Error generating forecasts:', error);
      alert('Error generating forecasts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCombinedData = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/data/combined`);
      setCombinedData(response.data.data);
    } catch (error) {
      console.error('Error fetching combined data:', error);
    }
  };

  const fetchLineupData = async (lineup) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/data/lineup/${lineup}`);
      setLineupData(response.data.data);
      setSelectedLineup(lineup);
    } catch (error) {
      console.error('Error fetching lineup data:', error);
    }
  };

  const exportCSV = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/export/csv`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'forecasting_results.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting CSV:', error);
    }
  };

  const renderLineChart = () => {
    if (!lineupData.length) return null;

    const sortedData = lineupData.sort((a, b) => new Date(a.DATE) - new Date(b.DATE));
    const labels = sortedData.map(item => new Date(item.DATE).toLocaleDateString());
    
    const actualData = sortedData.map(item => item.Actual);
    const planData = sortedData.map(item => item.Plan);
    const forecastData = sortedData.map(item => item.Forecast);

    const data = {
      labels,
      datasets: [
        {
          label: 'Actual',
          data: actualData,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
        },
        {
          label: 'Plan',
          data: planData,
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
        },
        {
          label: 'Forecast',
          data: forecastData,
          borderColor: 'rgb(245, 101, 101)',
          backgroundColor: 'rgba(245, 101, 101, 0.1)',
          tension: 0.4,
        },
      ],
    };

    const options = {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: `Time Series Analysis - ${selectedLineup}`,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    };

    return <Line data={data} options={options} />;
  };

  const renderOverviewChart = () => {
    if (!combinedData.length) return null;

    // Aggregate data by month for overview
    const monthlyData = {};
    combinedData.forEach(item => {
      const month = item.DATE.substring(0, 7); // YYYY-MM format
      if (!monthlyData[month]) {
        monthlyData[month] = { actual: 0, plan: 0, forecast: 0, count: 0 };
      }
      if (item.Actual) monthlyData[month].actual += item.Actual;
      if (item.Plan) monthlyData[month].plan += item.Plan;
      if (item.Forecast) monthlyData[month].forecast += item.Forecast;
      monthlyData[month].count++;
    });

    const sortedMonths = Object.keys(monthlyData).sort();
    const labels = sortedMonths.map(month => new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
    
    const data = {
      labels,
      datasets: [
        {
          label: 'Total Actual',
          data: sortedMonths.map(month => monthlyData[month].actual),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
        },
        {
          label: 'Total Plan',
          data: sortedMonths.map(month => monthlyData[month].plan),
          backgroundColor: 'rgba(16, 185, 129, 0.8)',
        },
        {
          label: 'Total Forecast',
          data: sortedMonths.map(month => monthlyData[month].forecast),
          backgroundColor: 'rgba(245, 101, 101, 0.8)',
        },
      ],
    };

    const options = {
      responsive: true,
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Monthly Aggregated View',
        },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    };

    return <Bar data={data} options={options} />;
  };

  const renderHierarchySelector = () => {
    const lineups = [];
    Object.keys(hierarchy).forEach(profile => {
      Object.keys(hierarchy[profile]).forEach(lineItem => {
        Object.keys(hierarchy[profile][lineItem]).forEach(site => {
          hierarchy[profile][lineItem][site].forEach(lineup => {
            lineups.push({
              lineup,
              profile,
              lineItem,
              site
            });
          });
        });
      });
    });

    return (
      <div className="hierarchy-selector">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Lineup for Detailed Analysis:
        </label>
        <select
          value={selectedLineup}
          onChange={(e) => e.target.value && fetchLineupData(e.target.value)}
          className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Choose a lineup...</option>
          {lineups.map((item, index) => (
            <option key={index} value={item.lineup}>
              {item.profile} → {item.lineItem} → {item.site} → {item.lineup}
            </option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Forecasting Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={generateForecasts}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? (
                  <RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4" />
                ) : (
                  <TrendingUp className="-ml-1 mr-2 h-4 w-4" />
                )}
                {loading ? 'Generating...' : 'Generate Forecasts'}
              </button>
              {forecastGenerated && (
                <button
                  onClick={exportCSV}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Download className="-ml-1 mr-2 h-4 w-4" />
                  Export CSV
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Data Summary Cards */}
        {dataSummary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <Database className="h-8 w-8 text-blue-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Historical Data</p>
                  <p className="text-2xl font-semibold text-gray-900">{dataSummary.sample_data.rows} rows</p>
                  <p className="text-sm text-gray-500">
                    {dataSummary.sample_data.date_range.start} to {dataSummary.sample_data.date_range.end}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Plan Data</p>
                  <p className="text-2xl font-semibold text-gray-900">{dataSummary.plan_data.rows} rows</p>
                  <p className="text-sm text-gray-500">
                    {dataSummary.plan_data.date_range.start} to {dataSummary.plan_data.date_range.end}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <BarChart3 className="h-8 w-8 text-purple-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Unique Lineups</p>
                  <p className="text-2xl font-semibold text-gray-900">{dataSummary.sample_data.unique_lineups}</p>
                  <p className="text-sm text-gray-500">Available for forecasting</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('detailed')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'detailed'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Detailed Analysis
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div>
                {forecastGenerated ? (
                  <div className="space-y-6">
                    <div className="h-96">
                      {renderOverviewChart()}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <TrendingUp className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No forecasts generated</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Click "Generate Forecasts" to create forecasts for 2025
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'detailed' && (
              <div className="space-y-6">
                {renderHierarchySelector()}
                
                {selectedLineup && lineupData.length > 0 ? (
                  <div className="h-96">
                    {renderLineChart()}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Select a lineup</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Choose a lineup from the dropdown to view detailed analysis
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status Message */}
        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <RefreshCw className="animate-spin h-5 w-5 text-blue-400" />
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  Generating forecasts... This may take a few moments.
                </p>
              </div>
            </div>
          </div>
        )}

        {forecastGenerated && !loading && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex">
              <TrendingUp className="h-5 w-5 text-green-400" />
              <div className="ml-3">
                <p className="text-sm text-green-700">
                  Forecasts generated successfully! You can now explore the data and export results.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;