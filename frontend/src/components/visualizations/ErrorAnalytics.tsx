import React from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';

interface ErrorAnalyticsProps {
  errorStats: {
    errorCounts: Record<string, number>;
    trends: Array<{
      hour: number;
      count: number;
      types: Record<string, number>;
    }>;
  };
}

const COLORS = ['#EF4444', '#F59E0B', '#3B82F6', '#10B981'];

export const ErrorAnalytics: React.FC<ErrorAnalyticsProps> = ({ errorStats }) => {
  const errorTypes = Object.entries(errorStats.errorCounts).map(([name, value]) => ({
    name,
    value
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold mb-4">Error Distribution</h3>
        <div className="h-64">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={errorTypes}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {errorTypes.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold mb-4">Error Trends</h3>
        <div className="h-64">
          <ResponsiveContainer>
            <BarChart data={errorStats.trends}>
              <Bar dataKey="count" fill="#3B82F6" />
              <Tooltip
                labelFormatter={(hour) => `Hour ${hour}:00`}
                formatter={(value) => [`${value} errors`, 'Count']}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
