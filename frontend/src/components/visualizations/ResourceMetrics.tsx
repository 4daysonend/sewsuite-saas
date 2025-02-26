import { type FC, Component } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  type TooltipProps
} from 'recharts';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** Props for metric data type */
interface MetricData {
  /** ISO timestamp */
  timestamp: string;
  /** CPU usage percentage (0-100) */
  cpu: number;
  /** Memory usage in bytes */
  memory: number;
  /** Disk usage percentage (0-100) */
  disk: number;
  /** Network usage in bytes/s */
  network: number;
}

/** Props for resource metrics summary */
interface MetricsSummary {
  cpu: {
    current: number;
    average: number;
    peak: number;
  };
  memory: {
    current: number;
    available: number;
    total: number;
  };
  disk: {
    used: number;
    available: number;
    total: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    connections: number;
  };
}

/** Main component props */
interface ResourceMetricsProps {
  /** Resource metrics data */
  data?: {
    /** Array of metric measurements over time */
    metrics: MetricData[];
    /** Summary of current metrics */
    summary: MetricsSummary;
  };
  /** Loading state */
  loading?: boolean;
  /** Error message if any */
  error?: string;
}

/** Props for metric card component */
interface MetricCardProps {
  /** Card title */
  title: string;
  /** Main value to display */
  value: string;
  /** Secondary value to display */
  subValue: string;
  /** Color class for value */
  valueColor: string;
}

/** Props for chart container */
interface ChartContainerProps {
  /** Chart content */
  children: React.ReactNode;
  /** Loading state */
  loading?: boolean;
  /** Title for the chart */
  title: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const formatPercent = (value: number): string => `${value.toFixed(1)}%`;

const MetricCard: FC<MetricCardProps> = ({
  title,
  value,
  subValue,
  valueColor
}) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
      <div className="text-sm text-gray-600">{subValue}</div>
    </CardContent>
  </Card>
);

class ChartErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive">
          <AlertTitle>Chart Error</AlertTitle>
          <AlertDescription>
            {this.state.error?.message || 'An error occurred while rendering the chart.'}
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}

const ChartContainer: FC<ChartContainerProps> = ({
  children,
  loading,
  title
}) => (
  <Card>
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="relative h-72">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent" />
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </CardContent>
  </Card>
);

const ResourceMetrics: FC<ResourceMetricsProps> = ({ data, loading, error }) => {
  if (loading) {
    return (
      <Alert>
        <AlertTitle>Loading</AlertTitle>
        <AlertDescription className="flex justify-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent" />
        </AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data || !data.summary || !data.metrics) {
    return (
      <Alert>
        <AlertTitle>No Data</AlertTitle>
        <AlertDescription>Resource metrics data is not available.</AlertDescription>
      </Alert>
    );
  }

  const {
    summary: {
      cpu = { current: 0, average: 0, peak: 0 },
      memory = { current: 0, available: 0, total: 0 },
      disk = { used: 0, available: 0, total: 0 },
      network = { bytesIn: 0, bytesOut: 0, connections: 0 },
    } = {},
    metrics = [],
  } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="CPU Usage"
          value={formatPercent(cpu.current)}
          subValue={`Peak: ${formatPercent(cpu.peak)}`}
          valueColor="text-blue-600"
        />
        <MetricCard
          title="Memory Usage"
          value={formatBytes(memory.current)}
          subValue={`Available: ${formatBytes(memory.available)}`}
          valueColor="text-emerald-600"
        />
        <MetricCard
          title="Disk Usage"
          value={formatPercent((disk.used / (disk.total || 1)) * 100)}
          subValue={`Available: ${formatBytes(disk.available)}`}
          valueColor="text-amber-600"
        />
        <MetricCard
          title="Network"
          value={network.connections.toString()}
          subValue={`In: ${formatBytes(network.bytesIn)}/s`}
          valueColor="text-purple-600"
        />
      </div>

      {metrics.length > 0 && (
        <div className="space-y-6">
          <ChartErrorBoundary>
            <ChartContainer title="Resource Usage Over Time" loading={loading}>
              <LineChart data={metrics}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                />
                <YAxis />
                <Tooltip
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                  formatter={(value: number, name: string) => [
                    `${formatPercent(value)}`,
                    name.charAt(0).toUpperCase() + name.slice(1)
                  ]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="cpu"
                  stroke="#3B82F6"
                  name="CPU"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="memory"
                  stroke="#10B981"
                  name="Memory"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="disk"
                  stroke="#F59E0B"
                  name="Disk"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="network"
                  stroke="#8B5CF6"
                  name="Network"
                  strokeWidth={2}
                />
              </LineChart>
            </ChartContainer>
          </ChartErrorBoundary>
        </div>
      )}
    </div>
  );
};

export default ResourceMetrics;