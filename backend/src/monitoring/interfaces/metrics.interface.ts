export interface SystemMetrics {
  api: {
    requestCount: number;
    averageResponseTime: number;
    errorRate: number;
    topEndpoints: {
      path: string;
      method: string;
      count: number;
      averageResponseTime: number;
    }[];
  };
  system?: {
    cpu: number;
    memory: number;
    disk?: number;
    uptime?: number;
    historical?: {
      timestamp: string;
      cpu: number;
      memory: number;
    }[];
  };
  errors?: {
    total: number;
    byType: {
      type: string;
      count: number;
      percentage: number;
      recentErrors: any[];
    }[];
    timeRange: {
      startTime: string;
      endTime: string;
    };
  };
  alerts?: {
    total: number;
    active: number;
    resolved: number;
    recent: any[];
  };
  timestamp: string;
}

export interface HealthStatus {
  status: 'healthy' | 'warning' | 'critical';
  timestamp: string;
  components: {
    cpu: {
      status: 'healthy' | 'warning' | 'critical';
      usage: number;
      cores: number;
    };
    memory: {
      status: 'healthy' | 'warning' | 'critical';
      total: number;
      used: number;
      usage: number;
    };
    database: {
      status: 'healthy' | 'warning' | 'critical';
    };
    redis: {
      status: 'healthy' | 'warning' | 'critical';
    };
  };
}

export interface PerformanceMetrics {
  current: {
    cpu: number;
    memory: number;
    uptime: number;
  };
  historical: {
    timestamp: string;
    cpu: number;
    memory: number;
  }[];
  timeframe: string;
  timeRange: {
    startTime: string;
    endTime: string;
  };
}

export interface UploadMetrics {
  metrics: {
    totalUploads: number;
    totalSize: number;
    averageSize: number;
    fileTypes: Record<string, number>;
    byDay: {
      day: string;
      count: number;
      size: number;
    }[];
  };
  period: string;
  timeRange: {
    start: string;
    end: string;
  };
  filters: {
    fileType: string;
  };
  timestamp: string;
}
