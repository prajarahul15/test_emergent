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
import { 
  Download, 
  RefreshCw, 
  TrendingUp, 
  Database, 
  Calendar, 
  BarChart3, 
  Filter,
  ChevronDown,
  LineChart,
  PieChart,
  Settings
} from 'lucide-react';
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
  const [hierarchyOptions, setHierarchyOptions] = useState({});
  const [combinedData, setCombinedData] = useState([]);
  const [yearlyData, setYearlyData] = useState([]);
  const [selectedLineup, setSelectedLineup] = useState('');
  const [lineupData, setLineupData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [forecastGenerated, setForecastGenerated] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [viewMode, setViewMode] = useState('trend'); // 'trend', 'yearly', 'forecast'
  
  // Hierarchy filters
  const [filters, setFilters] = useState({
    profile: '',
    line_item: '',
    body: '',
    site: '',
    lineup: ''
  });
  
  const [filteredData, setFilteredData] = useState([]);

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

  const fetchHierarchyOptions = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/data/hierarchy-options`);
      setHierarchyOptions(response.data);
    } catch (error) {
      console.error('Error fetching hierarchy options:', error);
    }
  };

  const fetchYearlyData = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/data/yearly-summary`);
      setYearlyData(response.data.yearly_data);
    } catch (error) {
      console.error('Error fetching yearly data:', error);
    }
  };

  const generateForecasts = async () => {
    setLoading(true);
    try {
      await axios.post(`${BACKEND_URL}/api/forecast/generate`);
      setForecastGenerated(true);
      fetchCombinedData();
      fetchHierarchyOptions();
      fetchYearlyData();
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

  const fetchFilteredData = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      
      const response = await axios.get(`${BACKEND_URL}/api/data/filtered?${params}`);
      setFilteredData(response.data.data);
    } catch (error) {
      console.error('Error fetching filtered data:', error);
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

  const handleFilterChange = (filterType, value) => {
    const newFilters = { ...filters, [filterType]: value };
    
    // Reset dependent filters
    const hierarchy = ['profile', 'line_item', 'body', 'site', 'lineup'];
    const currentIndex = hierarchy.indexOf(filterType);
    
    hierarchy.slice(currentIndex + 1).forEach(level => {
      newFilters[level] = '';
    });
    
    setFilters(newFilters);
  };

  useEffect(() => {
    if (forecastGenerated) {
      fetchFilteredData();
    }
  }, [filters, forecastGenerated]);

  const renderYearlyLineChart = () => {
    if (!yearlyData.length) return null;

    const chartData = {
      labels: yearlyData[0]?.months.map(m => m.month_name) || [],
      datasets: []
    };

    yearlyData.forEach((yearData, index) => {
      const colors = [
        { border: 'rgb(59, 130, 246)', bg: 'rgba(59, 130, 246, 0.1)' }, // Blue
        { border: 'rgb(16, 185, 129)', bg: 'rgba(16, 185, 129, 0.1)' }, // Green
        { border: 'rgb(245, 101, 101)', bg: 'rgba(245, 101, 101, 0.1)' }, // Red
        { border: 'rgb(139, 92, 246)', bg: 'rgba(139, 92, 246, 0.1)' }, // Purple
      ];

      const color = colors[index % colors.length];

      if (yearData.year <= 2024) {
        // Historical data - show actual values
        chartData.datasets.push({
          label: `${yearData.year} Actual`,
          data: yearData.months.map(m => m.actual),
          borderColor: color.border,
          backgroundColor: color.bg,
          tension: 0.4,
          fill: false
        });
      } else {
        // 2025 data - show both synthetic actual, plan, and forecast
        chartData.datasets.push({
          label: `${yearData.year} Synthetic Actual`,
          data: yearData.months.map(m => m.synthetic_actual),
          borderColor: 'rgb(251, 146, 60)', // Orange
          backgroundColor: 'rgba(251, 146, 60, 0.1)',
          tension: 0.4,
          fill: false,
          borderDash: [5, 5]
        });
        
        chartData.datasets.push({
          label: `${yearData.year} Plan`,
          data: yearData.months.map(m => m.plan),
          borderColor: 'rgb(16, 185, 129)', // Green
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: false
        });
        
        chartData.datasets.push({
          label: `${yearData.year} Forecast`,
          data: yearData.months.map(m => m.forecast),
          borderColor: 'rgb(245, 101, 101)', // Red
          backgroundColor: 'rgba(245, 101, 101, 0.1)',
          tension: 0.4,
          fill: false
        });
      }
    });

    const options = {
      responsive: true,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Year-wise Monthly Comparison',
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Values'
          }
        },
        x: {
          title: {
            display: true,
            text: 'Months'
          }
        }
      },
    };

    return <Line data={chartData} options={options} />;
  };

  const renderTrendChart = () => {
    if (!filteredData.length) return null;

    // Aggregate data by month for trend view
    const monthlyData = {};
    filteredData.forEach(item => {
      const month = item.DATE.substring(0, 7); // YYYY-MM format
      if (!monthlyData[month]) {
        monthlyData[month] = { actual: 0, plan: 0, forecast: 0, synthetic_actual: 0, count: 0 };
      }
      if (item.Actual) monthlyData[month].actual += item.Actual;
      if (item.Plan) monthlyData[month].plan += item.Plan;
      if (item.Forecast) monthlyData[month].forecast += item.Forecast;
      if (item.Synthetic_Actual) monthlyData[month].synthetic_actual += item.Synthetic_Actual;
      monthlyData[month].count++;
    });

    const sortedMonths = Object.keys(monthlyData).sort();
    const labels = sortedMonths.map(month => new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
    
    const data = {
      labels,
      datasets: [
        {
          label: 'Historical Actual',
          data: sortedMonths.map(month => monthlyData[month].actual || null),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: false
        },
        {
          label: '2025 Synthetic Actual',
          data: sortedMonths.map(month => monthlyData[month].synthetic_actual || null),
          borderColor: 'rgb(251, 146, 60)',
          backgroundColor: 'rgba(251, 146, 60, 0.1)',
          tension: 0.4,
          fill: false,
          borderDash: [5, 5]
        },
        {
          label: '2025 Plan',
          data: sortedMonths.map(month => monthlyData[month].plan || null),
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: false
        },
        {
          label: '2025 Forecast',
          data: sortedMonths.map(month => monthlyData[month].forecast || null),
          borderColor: 'rgb(245, 101, 101)',
          backgroundColor: 'rgba(245, 101, 101, 0.1)',
          tension: 0.4,
          fill: false
        },
      ],
    };

    const options = {
      responsive: true,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
        },
        title: {
          display: true,
          text: 'Trend Analysis with Synthetic Actuals',
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Values'
          }
        }
      },
    };

    return <Line data={data} options={options} />;
  };

  const renderLineChart = () => {
    if (!lineupData.length) return null;

    const sortedData = lineupData.sort((a, b) => new Date(a.DATE) - new Date(b.DATE));
    const labels = sortedData.map(item => new Date(item.DATE).toLocaleDateString());
    
    const actualData = sortedData.map(item => item.Actual);
    const planData = sortedData.map(item => item.Plan);
    const forecastData = sortedData.map(item => item.Forecast);
    const syntheticActualData = sortedData.map(item => item.Synthetic_Actual);

    const data = {
      labels,
      datasets: [
        {
          label: 'Historical Actual',
          data: actualData,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
        },
        {
          label: '2025 Synthetic Actual',
          data: syntheticActualData,
          borderColor: 'rgb(251, 146, 60)',
          backgroundColor: 'rgba(251, 146, 60, 0.1)',
          tension: 0.4,
          borderDash: [5, 5]
        },
        {
          label: '2025 Plan',
          data: planData,
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
        },
        {
          label: '2025 Forecast',
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

  const renderHierarchySelector = () => {
    // Get lineups from hierarchyOptions if available, otherwise fallback to hierarchy parsing
    let lineupOptions = [];
    
    if (hierarchyOptions.lineups && hierarchyOptions.lineups.length > 0) {
      lineupOptions = hierarchyOptions.lineups;
    } else {
      // Fallback to parsing hierarchy structure
      Object.keys(hierarchy).forEach(profile => {
        Object.keys(hierarchy[profile]).forEach(lineItem => {
          Object.keys(hierarchy[profile][lineItem]).forEach(site => {
            hierarchy[profile][lineItem][site].forEach(lineup => {
              if (!lineupOptions.includes(lineup)) {
                lineupOptions.push(lineup);
              }
            });
          });
        });
      });
    }

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
          {lineupOptions.map((lineup, index) => (
            <option key={index} value={lineup}>
              {lineup}
            </option>
          ))}
        </select>
        {lineupOptions.length === 0 && (
          <p className="text-sm text-gray-500 mt-1">
            Generate forecasts first to populate lineup options
          </p>
        )}
      </div>
    );
  };

  const renderHierarchyFilters = () => {
    if (!hierarchyOptions.profiles) return null;

    return (
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex items-center mb-4">
          <Filter className="h-5 w-5 text-blue-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Hierarchy Filters</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Profile</label>
            <select
              value={filters.profile}
              onChange={(e) => handleFilterChange('profile', e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">All Profiles</option>
              {hierarchyOptions.profiles.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Line Item</label>
            <select
              value={filters.line_item}
              onChange={(e) => handleFilterChange('line_item', e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">All Line Items</option>
              {hierarchyOptions.line_items.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
            <select
              value={filters.body}
              onChange={(e) => handleFilterChange('body', e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">All Bodies</option>
              {hierarchyOptions.bodies.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Site</label>
            <select
              value={filters.site}
              onChange={(e) => handleFilterChange('site', e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">All Sites</option>
              {hierarchyOptions.sites.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lineup</label>
            <select
              value={filters.lineup}
              onChange={(e) => handleFilterChange('lineup', e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">All Lineups</option>
              {hierarchyOptions.lineups.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    );
  };

  const renderViewModeSelector = () => {
    return (
      <div className="flex items-center space-x-2 mb-4">
        <Settings className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">View Mode:</span>
        <div className="flex rounded-md shadow-sm">
          <button
            onClick={() => setViewMode('trend')}
            className={`px-3 py-1 text-xs font-medium rounded-l-md border ${
              viewMode === 'trend' 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <LineChart className="h-3 w-3 inline mr-1" />
            Trend
          </button>
          <button
            onClick={() => setViewMode('yearly')}
            className={`px-3 py-1 text-xs font-medium border-t border-b ${
              viewMode === 'yearly' 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <BarChart3 className="h-3 w-3 inline mr-1" />
            Yearly
          </button>
          <button
            onClick={() => setViewMode('forecast')}
            className={`px-3 py-1 text-xs font-medium rounded-r-md border ${
              viewMode === 'forecast' 
                ? 'bg-blue-600 text-white border-blue-600' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <PieChart className="h-3 w-3 inline mr-1" />
            Forecast
          </button>
        </div>
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
              <h1 className="text-2xl font-bold text-gray-900">Advanced Forecasting Dashboard</h1>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6 card-hover">
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
            
            <div className="bg-white rounded-lg shadow p-6 card-hover">
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
            
            <div className="bg-white rounded-lg shadow p-6 card-hover">
              <div className="flex items-center">
                <BarChart3 className="h-8 w-8 text-purple-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Unique Lineups</p>
                  <p className="text-2xl font-semibold text-gray-900">{dataSummary.sample_data.unique_lineups}</p>
                  <p className="text-sm text-gray-500">Available for forecasting</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6 card-hover">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-orange-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Forecast Status</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {forecastGenerated ? 'Generated' : 'Pending'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {forecastGenerated ? 'With synthetic actuals' : 'Click Generate button'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hierarchy Filters */}
        {forecastGenerated && renderHierarchyFilters()}

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
                Enhanced Overview
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
                    {renderViewModeSelector()}
                    <div className="h-96">
                      {viewMode === 'trend' && renderTrendChart()}
                      {viewMode === 'yearly' && renderYearlyLineChart()}
                      {viewMode === 'forecast' && renderTrendChart()}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <TrendingUp className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No forecasts generated</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Click "Generate Forecasts" to create forecasts with synthetic actuals for 2025
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
                      Choose a lineup from the dropdown to view detailed analysis with synthetic actuals
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status Messages */}
        {loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
            <div className="flex">
              <RefreshCw className="animate-spin h-5 w-5 text-blue-400" />
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  Generating forecasts and synthetic actuals... This may take a few moments.
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
                  Forecasts and synthetic actuals generated successfully! 2025 actuals are based on seasonal averages from historical data.
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