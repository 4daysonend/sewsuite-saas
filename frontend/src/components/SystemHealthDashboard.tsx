import React, { useEffect, useState } from "react";
import { useMetrics } from "../hooks/useMetrics";
import { Alert, SystemStatus } from "../types/monitoring";
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/common/Loader";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const StatusIndicator = ({ status }: { status: 'healthy' | 'degraded' | 'unhealthy' }) => {
  const colors = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    unhealthy: 'bg-red-500',
  };

  const labels = {
    healthy: 'Healthy',
    degraded: 'Degraded',
    unhealthy: 'Unhealthy',
  };

  return (
    <div className="flex items-center">
      <div className={`w-3 h-3 rounded-full ${colors[status]} mr-2`}></div>
      <span className="text-sm font-medium">{labels[status]}</span>
    </div>
  );
};

const Header = ({ 
  timeframe, 
  onTimeframeChange 
}: { 
  timeframe: string; 
  onTimeframeChange: (timeframe: string) => void;
}) => (
  <div className="flex justify-between items-center">
    <h1 className="text-2xl font-bold text-gray-900">System Health</h1>
    <div className="flex space-x-2">
      <select
        value={timeframe}
        onChange={(e) => onTimeframeChange(e.target.value)}
        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
      >
        <option value="5m">Last 5 minutes</option>
        <option value="1h">Last hour</option>
        <option value="24h">Last 24 hours</option>
        <option value="7d">Last 7 days</option>
      </select>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
      >
        Refresh
      </button>
    </div>
  </div>
);

const SystemHealthDashboard = () => {
  const { metrics, loading, error } = useMetrics();
  const [chartData, setChartData] = useState([]);
  const [timeframe, setTimeframe] = useState("5m");

  useEffect(() => {
    if (metrics) {
      const formattedData = metrics.performance.timeline.map((entry) => ({
        timestamp: new Date(entry.timestamp).toLocaleTimeString(),
        cpu: entry.cpu,
        memory: entry.memory,
      }));
      setChartData(formattedData);
    }
  }, [metrics]);

  if (loading) return <Loader message="Loading system metrics..." />;
  if (error) return <Alert type="error" message={error} />;

  return (
    <div className="p-4 space-y-4">
      <Header timeframe={timeframe} onTimeframeChange={setTimeframe} />
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent>
            <h2 className="text-xl font-semibold">CPU Usage</h2>
            <p className="text-2xl">{metrics?.performance.cpu}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <h2 className="text-xl font-semibold">Memory Usage</h2>
            <p className="text-2xl">{metrics?.performance.memory}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <h2 className="text-xl font-semibold">Active Connections</h2>
            <p className="text-2xl">{metrics?.performance.activeConnections}</p>
          </CardContent>
        </Card>
        <Card className="col-span-full">
          <CardContent>
            <h2 className="text-xl font-semibold">Performance Over Time</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <XAxis dataKey="timestamp" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="cpu" stroke="#8884d8" />
                <Line type="monotone" dataKey="memory" stroke="#82ca9d" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SystemHealthDashboard;
