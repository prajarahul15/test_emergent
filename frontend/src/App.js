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
  Filler,
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
  Settings,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Target,
  Activity,
  Users
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
  Legend,
  Filler
);

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function App() {
  const [dataSummary, setDataSummary] = useState(null);
  const [hierarchy, setHierarchy] = useState({});
  const [hierarchyOptions, setHierarchyOptions] = useState({});
  const [combinedData, setCombinedData] = useState([]);
  const [yearlyData, setYearlyData] = useState([]);
  const [accuracyData, setAccuracyData] = useState(null);
  const [selectedLineups, setSelectedLineups] = useState([]); // Multi-select
  const [multiLineupData, setMultiLineupData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [forecastGenerated, setForecastGenerated] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [viewMode, setViewMode] = useState('trend');
  
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

  const fetchAccuracyData = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/forecast/accuracy`);
      setAccuracyData(response.data);
    } catch (error) {
      console.error('Error fetching accuracy data:', error);
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
      fetchAccuracyData();
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

  const fetchMultiLineupData = async (lineups) => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/data/multi-lineup?lineups=${lineups.join(',')}`);
      setMultiLineupData(response.data.data);
    } catch (error) {
      console.error('Error fetching multi-lineup data:', error);
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
      link.setAttribute('download', 'enhanced_forecasting_results.csv');
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

  const handleLineupSelection = (lineup, isSelected) => {
    if (isSelected) {
      setSelectedLineups([...selectedLineups, lineup]);
    } else {
      setSelectedLineups(selectedLineups.filter(l => l !== lineup));
    }
  };

  useEffect(() => {
    if (forecastGenerated) {
      fetchFilteredData();
    }
  }, [filters, forecastGenerated]);

  useEffect(() => {
    if (selectedLineups.length > 0) {
      fetchMultiLineupData(selectedLineups);
    }
  }, [selectedLineups]);

  const renderAccuracyDashboard = () => {
    if (!accuracyData) return null;

    const { lineup_accuracy, overall_statistics } = accuracyData;
    
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex items-center mb-4">
          <Target className="h-5 w-5 text-green-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Forecast Accuracy Dashboard</h3>
        </div>
        
        {/* Overall Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center">
              <Activity className="h-5 w-5 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-600">Avg MAPE</p>
                <p className="text-lg font-semibold text-blue-900">
                  {overall_statistics.avg_mape ? `${(overall_statistics.avg_mape * 100).toFixed(1)}%` : 'N/A'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-green-600">Low Risk</p>
                <p className="text-lg font-semibold text-green-900">
                  {overall_statistics.risk_distribution.low} lineups
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-yellow-600">Medium Risk</p>
                <p className="text-lg font-semibold text-yellow-900">
                  {overall_statistics.risk_distribution.medium} lineups
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-red-50 rounded-lg p-4">
            <div className="flex items-center">
              <XCircle className="h-5 w-5 text-red-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-red-600">High Risk</p>
                <p className="text-lg font-semibold text-red-900">
                  {overall_statistics.risk_distribution.high} lineups
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Lineup Accuracy Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lineup</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Risk Level</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MAPE</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">RMSE</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Forecast</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lineup_accuracy.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.lineup}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                    {item.model_type.replace('_', ' ')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      item.risk_level === 'low' ? 'bg-green-100 text-green-800' :
                      item.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {item.risk_level}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.mape ? `${(item.mape * 100).toFixed(1)}%` : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.rmse ? item.rmse.toFixed(2) : 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.avg_forecast.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderMultiLineupSelector = () => {
    if (!hierarchyOptions.lineups) return null;

    return (
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex items-center mb-4">
          <Users className="h-5 w-5 text-purple-600 mr-2" />
          <h3 className="text-lg font-semibold text-gray-900">Multi-Lineup Comparison</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {hierarchyOptions.lineups.map((lineup, index) => (
            <label key={index} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-gray-50">
              <input
                type="checkbox"
                checked={selectedLineups.includes(lineup)}
                onChange={(e) => handleLineupSelection(lineup, e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm font-medium text-gray-900">{lineup}</span>
            </label>
          ))}
        </div>
        
        <div className="mt-4 text-sm text-gray-500">
          Selected: {selectedLineups.length} lineup(s)
        </div>
      </div>
    );
  };

  const renderDetailedAnalysisWithConfidence = () => {
    if (!multiLineupData.length) return null;

    // Process data for chart
    const chartData = {};
    const labels = [];
    
    multiLineupData.forEach(item => {
      const date = item.DATE;
      const lineup = item.Lineup;
      
      if (!chartData[lineup]) {
        chartData[lineup] = {
          actual: [],
          synthetic_actual: [],
          plan: [],
          forecast: [],
          forecast_lower: [],
          forecast_upper: [],
          dates: []
        };
      }
      
      chartData[lineup].dates.push(date);
      chartData[lineup].actual.push(item.Actual);
      chartData[lineup].synthetic_actual.push(item.Synthetic_Actual);
      chartData[lineup].plan.push(item.Plan);
      chartData[lineup].forecast.push(item.Forecast);
      chartData[lineup].forecast_lower.push(item.Forecast_Lower);
      chartData[lineup].forecast_upper.push(item.Forecast_Upper);
      
      if (!labels.includes(date)) {
        labels.push(date);
      }
    });

    labels.sort();
    const colors = [
      { border: 'rgb(59, 130, 246)', bg: 'rgba(59, 130, 246, 0.1)' }, // Blue
      { border: 'rgb(16, 185, 129)', bg: 'rgba(16, 185, 129, 0.1)' }, // Green
      { border: 'rgb(245, 101, 101)', bg: 'rgba(245, 101, 101, 0.1)' }, // Red
      { border: 'rgb(139, 92, 246)', bg: 'rgba(139, 92, 246, 0.1)' }, // Purple
    ];

    const datasets = [];
    
    selectedLineups.forEach((lineup, index) => {
      const lineupData = chartData[lineup];
      const color = colors[index % colors.length];
      
      if (lineupData) {
        // Historical Actual
        datasets.push({
          label: `${lineup} - Historical`,
          data: labels.map(date => {
            const idx = lineupData.dates.indexOf(date);
            return idx >= 0 ? lineupData.actual[idx] : null;
          }),
          borderColor: color.border,
          backgroundColor: color.bg,
          tension: 0.4,
          fill: false,
          pointRadius: 2
        });

        // Synthetic Actual  
        datasets.push({
          label: `${lineup} - Synthetic Actual`,
          data: labels.map(date => {
            const idx = lineupData.dates.indexOf(date);
            return idx >= 0 ? lineupData.synthetic_actual[idx] : null;
          }),
          borderColor: 'rgb(251, 146, 60)',
          backgroundColor: 'rgba(251, 146, 60, 0.1)',
          tension: 0.4,
          fill: false,
          borderDash: [5, 5],
          pointRadius: 2
        });

        // Plan
        datasets.push({
          label: `${lineup} - Plan`,
          data: labels.map(date => {
            const idx = lineupData.dates.indexOf(date);
            return idx >= 0 ? lineupData.plan[idx] : null;
          }),
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: false,
          pointRadius: 3
        });

        // Forecast with confidence intervals
        datasets.push({
          label: `${lineup} - Forecast`,
          data: labels.map(date => {
            const idx = lineupData.dates.indexOf(date);
            return idx >= 0 ? lineupData.forecast[idx] : null;
          }),
          borderColor: 'rgb(245, 101, 101)',
          backgroundColor: 'rgba(245, 101, 101, 0.1)',
          tension: 0.4,
          fill: false,
          pointRadius: 3
        });

        // Confidence interval upper bound
        datasets.push({
          label: `${lineup} - Upper Bound`,
          data: labels.map(date => {
            const idx = lineupData.dates.indexOf(date);
            return idx >= 0 ? lineupData.forecast_upper[idx] : null;
          }),
          borderColor: 'rgba(245, 101, 101, 0.3)',
          backgroundColor: 'rgba(245, 101, 101, 0.1)',
          tension: 0.4,
          fill: '+1',
          pointRadius: 0,
          borderDash: [2, 2]
        });

        // Confidence interval lower bound  
        datasets.push({
          label: `${lineup} - Lower Bound`,
          data: labels.map(date => {
            const idx = lineupData.dates.indexOf(date);
            return idx >= 0 ? lineupData.forecast_lower[idx] : null;
          }),
          borderColor: 'rgba(245, 101, 101, 0.3)',
          backgroundColor: 'rgba(245, 101, 101, 0.1)',
          tension: 0.4,
          fill: false,  
          pointRadius: 0,
          borderDash: [2, 2]
        });
      }
    });

    const chartOptions = {
      responsive: true,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            filter: function(legendItem) {
              return !legendItem.text.includes('Upper Bound') && !legendItem.text.includes('Lower Bound');
            }
          }
        },
        title: {
          display: true,
          text: 'Detailed Forecast Analysis with Confidence Intervals',
        },
        tooltip: {
          callbacks: {
            afterBody: function(context) {
              const dataIndex = context[0].dataIndex;
              const lineup = selectedLineups[0]; // Show tooltip for first lineup
              const lineupData = chartData[lineup];
              if (lineupData && lineupData.forecast_lower[dataIndex] && lineupData.forecast_upper[dataIndex]) {
                return `95% Confidence: ${lineupData.forecast_lower[dataIndex].toFixed(2)} - ${lineupData.forecast_upper[dataIndex].toFixed(2)}`;
              }
              return '';
            }
          }
        }
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
            text: 'Date'
          }
        }
      },
    };

    return (
      <div className="h-96">
        <Line data={{ labels, datasets }} options={chartOptions} />
      </div>
    );
  };

  const renderYearlyLineChart = () => {
    if (!yearlyData.length) return null;

    const chartData = {
      labels: yearlyData[0]?.months.map(m => m.month_name) || [],
      datasets: []
    };

    yearlyData.forEach((yearData, index) => {
      const colors = [
        { border: 'rgb(59, 130, 246)', bg: 'rgba(59, 130, 246, 0.1)' },
        { border: 'rgb(16, 185, 129)', bg: 'rgba(16, 185, 129, 0.1)' },
        { border: 'rgb(245, 101, 101)', bg: 'rgba(245, 101, 101, 0.1)' },
        { border: 'rgb(139, 92, 246)', bg: 'rgba(139, 92, 246, 0.1)' },
      ];

      const color = colors[index % colors.length];

      if (yearData.year <= 2024) {
        chartData.datasets.push({
          label: `${yearData.year} Actual`,
          data: yearData.months.map(m => m.actual),
          borderColor: color.border,
          backgroundColor: color.bg,
          tension: 0.4,
          fill: false
        });
      } else {
        chartData.datasets.push({
          label: `${yearData.year} Synthetic Actual`,
          data: yearData.months.map(m => m.synthetic_actual),
          borderColor: 'rgb(251, 146, 60)',
          backgroundColor: 'rgba(251, 146, 60, 0.1)',
          tension: 0.4,
          fill: false,
          borderDash: [5, 5]
        });
        
        chartData.datasets.push({
          label: `${yearData.year} Plan`,
          data: yearData.months.map(m => m.plan),
          borderColor: 'rgb(16, 185, 129)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: false
        });
        
        chartData.datasets.push({
          label: `${yearData.year} Forecast`,
          data: yearData.months.map(m => m.forecast),
          borderColor: 'rgb(245, 101, 101)',
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

    const monthlyData = {};
    filteredData.forEach(item => {
      const month = item.DATE.substring(0, 7);
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

  const renderHierarchyFilters = () => {
    if (!hierarchyOptions || !hierarchyOptions.profiles) return null;

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
              {(hierarchyOptions.profiles || []).map(option => (
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
              {(hierarchyOptions.line_items || []).map(option => (
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
              {(hierarchyOptions.bodies || []).map(option => (
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
              {(hierarchyOptions.sites || []).map(option => (
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
              {(hierarchyOptions.lineups || []).map(option => (
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
                    {forecastGenerated ? 'With confidence intervals' : 'Click Generate button'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Accuracy Dashboard - TOP RECOMMENDATION #1 */}
        {forecastGenerated && renderAccuracyDashboard()}

        {/* Hierarchy Filters */}
        {forecastGenerated && renderHierarchyFilters()}

        {/* Multi-Lineup Selector - TOP RECOMMENDATION #2 */}
        {forecastGenerated && renderMultiLineupSelector()}

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
                Detailed Analysis with Confidence
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
                      Click "Generate Forecasts" to create forecasts with confidence intervals for 2025
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'detailed' && (
              <div className="space-y-6">
                {selectedLineups.length > 0 ? (
                  <>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-blue-800">
                        Selected Lineups: {selectedLineups.join(', ')}
                      </h4>
                      <p className="text-sm text-blue-600 mt-1">
                        Showing detailed forecast analysis with 95% confidence intervals
                      </p>
                    </div>
                    {renderDetailedAnalysisWithConfidence()}
                  </>
                ) : (
                  <div className="text-center py-12">
                    <BarChart3 className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">Select lineups for analysis</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Choose one or more lineups from the Multi-Lineup Comparison section above
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
                  Generating forecasts with confidence intervals and accuracy metrics...
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
                  Enhanced forecasts generated successfully! Features: Confidence intervals, accuracy metrics, multi-lineup comparison, and synthetic actuals.
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