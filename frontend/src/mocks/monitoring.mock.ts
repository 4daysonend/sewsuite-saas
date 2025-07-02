export const mockMonitoringData = {
  metrics: {
    cpu: {
      usage: 42.5,
      cores: 4,
      threshold: 80
    },
    memory: {
      usage: 63.2,
      total: 16384, // 16GB in MB
      free: 6029,   // ~6GB in MB
      threshold: 85
    },
    disk: {
      usage: 48.7,
      total: 512000, // 500GB in MB
      free: 262759,  // ~256GB in MB
      threshold: 90
    },
    system: {
      activeConnections: 143,
      queuedJobs: 12,
      uptime: 345600 // 4 days in seconds
    }
  },
  health: {
    status: 'healthy',
    components: {
      database: {
        status: 'healthy',
        responseTime: 42
      },
      api: {
        status: 'healthy',
        responseTime: 126
      },
      storage: {
        status: 'healthy',
        usage: 48.7
      },
      memory: {
        status: 'healthy',
        usage: 63.2,
        total: 16384, // MB
        used: 10355   // MB
      },
      cache: {
        status: 'degraded',
        hitRatio: 75.3,
        usage: 82.1
      }
    },
    lastUpdated: new Date().toISOString()
  },
  alerts: [
    {
      id: 'alert-001',
      type: 'warning',
      component: 'cache',
      message: 'Cache hit ratio below threshold',
      timestamp: new Date(Date.now() - 1200000).toISOString(),
      status: 'active'
    },
    {
      id: 'alert-002',
      type: 'info',
      component: 'database',
      message: 'Database backup completed successfully',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      status: 'resolved'
    },
    {
      id: 'alert-003',
      type: 'critical',
      component: 'api',
      message: 'API endpoint /orders/process returning 500 errors',
      timestamp: new Date(Date.now() - 600000).toISOString(),
      status: 'active'
    },
    {
      id: 'alert-004',
      type: 'warning',
      component: 'memory',
      message: 'High memory usage detected',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      status: 'active'
    }
  ]
};