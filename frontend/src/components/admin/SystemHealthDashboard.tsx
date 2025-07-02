// src/components/admin/SystemHealthDashboard.tsx
import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import monitoringService from '../../services/monitoring.service';
import RoleBasedContent from '../common/RoleBasedContent';
import { UserRole } from '../../types/user';
import { formatBytes } from '../../utils/formatters';
import { useNavigate } from 'react-router-dom';

const SystemHealthDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [healthData, setHealthData] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState('1h');
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
    
    // Set up polling interval for real-time updates
    const interval = setInterval(fetchData, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [timeframe]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [metricsData, healthStatus, alertsData] = await Promise.all([
        monitoringService.getPerformanceMetrics(timeframe),
        monitoringService.getHealthStatus(),
        monitoringService.getAlerts({ status: 'active', limit: 5 })
      ]);
      
      setMetrics(metricsData);
      setHealthData(healthStatus);
      setAlerts(alertsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load monitoring data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'healthy': return '#10B981'; // green
      case 'warning': return '#F59E0B'; // amber
      case 'degraded': return '#F59E0B'; // amber
      case 'critical': case 'unhealthy': return '#EF4444'; // red
      default: return '#6B7280'; // gray
    }
  };

  if (loading && !metrics) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Only administrators should see this page
  return (
    <RoleBasedContent
      roles={[UserRole.ADMIN, UserRole.SUPERADMIN]}
      fallback={
        <div className="container mx-auto px-4 py-8">
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
            <p className="font-bold">Access Restricted</p>
            <p>You don't have permission to view system health data.</p>
          </div>
        </div>
      }
    >
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-wrap justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">System Health Dashboard</h1>
          
          <div className="flex items-center space-x-4">
            <select
              className="px-4 py-2 border rounded-lg"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
            >
              <option value="5m">Last 5 minutes</option>
              <option value="1h">Last hour</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
            </select>
            
            <button
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              onClick={fetchData}
            >
              Refresh
            </button>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6" role="alert">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        )}
        
        {/* Overall System Status */}
        {healthData && (
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <div className="flex items-center">
              <div className={`w-4 h-4 rounded-full mr-2 ${
                healthData.status === 'healthy' ? 'bg-green-500' : 
                healthData.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
              }`}></div>
              <h2 className="text-xl font-semibold">System Status: {healthData.status}</h2>
            </div>
            
            <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
              {Object.entries(healthData.components || {}).map(([key, component]: [string, any]) => (
                <div key={key} className="border rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <div className={`w-3 h-3 rounded-full mr-2 ${
                      component.status === 'healthy' ? 'bg-green-500' : 
                      component.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}></div>
                    <h3 className="font-medium capitalize">{key}</h3>
                  </div>
                  {component.usage !== undefined && (
                    <div className="mt-2">
                      <div className="text-sm text-gray-500 flex justify-between">
                        <span>Usage</span>
                        <span>{component.usage.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                        <div 
                          className={`h-2 rounded-full ${
                            component.usage < 70 ? 'bg-green-500' : 
                            component.usage < 90 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(component.usage, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  {key === 'memory' && (
                    <div className="mt-2 text-sm text-gray-500">
                      <p>{formatBytes(component.used * 1024 * 1024)} / {formatBytes(component.total * 1024 * 1024)}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Performance Metrics */}
        {metrics && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
              {/* CPU Usage Card */}
              <div className="bg-white shadow-md rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">CPU Usage</h2>
                <div className="text-3xl font-bold">{metrics.metrics.cpu.usage.toFixed(1)}%</div>
                <div className="mt-2 text-sm text-gray-500">
                  <div>Cores: {metrics.metrics.cpu.cores}</div>
                  <div>Threshold: {metrics.metrics.cpu.threshold}%</div>
                </div>
                <div className="mt-4 h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics.historical?.cpu || []}>
                      <Line type="monotone" dataKey="usage" stroke="#3B82F6" strokeWidth={2} dot={false} />
                      <XAxis dataKey="timestamp" hide />
                      <YAxis domain={[0, 100]} hide />
                      <Tooltip />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Memory Usage Card */}
              <div className="bg-white shadow-md rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Memory Usage</h2>
                <div className="text-3xl font-bold">{metrics.metrics.memory.usage.toFixed(1)}%</div>
                <div className="mt-2 text-sm text-gray-500">
                  <div>Total: {formatBytes(metrics.metrics.memory.total * 1024 * 1024)}</div>
                  <div>Threshold: {metrics.metrics.memory.threshold}%</div>
                </div>
                <div className="mt-4 h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics.historical?.memory || []}>
                      <Line type="monotone" dataKey="usage" stroke="#10B981" strokeWidth={2} dot={false} />
                      <XAxis dataKey="timestamp" hide />
                      <YAxis domain={[0, 100]} hide />
                      <Tooltip />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Network Connections Card */}
              <div className="bg-white shadow-md rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4">Network Connections</h2>
                <div className="text-3xl font-bold">{metrics.metrics.system.activeConnections}</div>
                <div className="mt-2 text-sm text-gray-500">
                  <div>Queued Jobs: {metrics.metrics.system.queuedJobs}</div>
                  <div>Uptime: {Math.floor(metrics.metrics.system.uptime / 60 / 60)} hours</div>
                </div>
                <div className="mt-4 h-36">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics.historical?.connections || []}>
                      <Bar dataKey="connections" fill="#8884d8" />
                      <XAxis dataKey="timestamp" hide />
                      <YAxis hide />
                      <Tooltip />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            
            {/* API Performance Chart */}
            <div className="bg-white shadow-md rounded-lg p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">API Performance</h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics.historical?.requests || []}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" 
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()} />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip 
                      formatter={(value, name) => {
                        if (name === 'latency') return [`${value.toFixed(0)} ms`, 'Response Time'];
                        return [value, name === 'success' ? 'Successful Requests' : 'Failed Requests'];
                      }}
                      labelFormatter={(label) => new Date(label).toLocaleString()}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="success" stroke="#10B981" name="success" />
                    <Line yAxisId="left" type="monotone" dataKey="error" stroke="#EF4444" name="error" />
                    <Line yAxisId="right" type="monotone" dataKey="latency" stroke="#6366F1" name="latency" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Active Alerts */}
            <div className="bg-white shadow-md rounded-lg p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Active Alerts</h2>
                <button 
                  className="text-sm text-blue-600 hover:text-blue-800"
                  onClick={() => navigate('/admin/alerts')}
                >
                  View All
                </button>
              </div>
              
              {alerts.length > 0 ? (
                <div className="space-y-4">
                  {alerts.map(alert => (
                    <div 
                      key={alert.id}
                      className={`border-l-4 p-4 ${
                        alert.type === 'critical' ? 'border-red-500 bg-red-50' :
                        alert.type === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                        'border-blue-500 bg-blue-50'
                      }`}
                    >
                      <div className="flex justify-between">
                        <div className="font-medium">
                          {alert.component && (
                            <span className="inline-block bg-gray-200 rounded px-2 py-1 text-xs mr-2 capitalize">
                              {alert.component}
                            </span>
                          )}
                          <span className={`${
                            alert.type === 'critical' ? 'text-red-700' :
                            alert.type === 'warning' ? 'text-yellow-700' :
                            'text-blue-700'
                          }`}>
                            {alert.message}
                          </span>
                        </div>
                        <span className="text-gray-500 text-sm">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No active alerts. All systems operating normally.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </RoleBasedContent>
  );
};

export default SystemHealthDashboard;