interface Config {
  apiUrl: string;
  websocketUrl: string;
  environment: string;
  sentryDsn?: string;
  googleAnalyticsId?: string;
  stripePublicKey?: string;
  maxFileUploadSize: number;
  featureFlags: {
    enableAnalytics: boolean;
    enableChat: boolean;
    enableNotifications: boolean;
  };
  securityConfig: {
    contentSecurityPolicy: {
      defaultSrc: string[];
      scriptSrc: string[];
      connectSrc: string[];
      imgSrc: string[];
      styleSrc: string[];
      // Other CSP directives
    };
  };
  apiVersion: string;
  allowedOrigins: string[]; // For CORS validation on the client side
  api: {
    rateLimits: {
      standard: number; // Requests per minute
      authenticated: number;
      critical: number; // For sensitive operations
    };
    retryConfig: {
      maxRetries: number;
      initialDelay: number;
      backoffFactor: number;
    };
  };
  securityHeaders: {
    strictTransportSecurity: string;
    xContentTypeOptions: string;
    xFrameOptions: string;
    referrerPolicy: string;
    permissionsPolicy: string;
  };
}

// Core configs that don't change
const coreConfig = {
  maxFileUploadSize: 10 * 1024 * 1024, // 10MB
  apiVersion: 'v1', // Current API version
};

// Development environment configuration
const devConfig: Config = {
  apiUrl: 'http://localhost:5000/api',
  websocketUrl: 'ws://localhost:5001',
  environment: 'development',
  ...coreConfig,
  featureFlags: {
    enableAnalytics: false,
    enableChat: true,
    enableNotifications: true,
  },
  securityConfig: {
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'"],
      styleSrc: ["'self'"],
    },
  },
  allowedOrigins: ['http://localhost:3000'],
  api: {
    rateLimits: {
      standard: 60,
      authenticated: 120,
      critical: 10,
    },
    retryConfig: {
      maxRetries: 3,
      initialDelay: 1000,
      backoffFactor: 2,
    },
  },
  securityHeaders: {
    strictTransportSecurity: '',
    xContentTypeOptions: '',
    xFrameOptions: '',
    referrerPolicy: '',
    permissionsPolicy: '',
  },
};

// Staging environment configuration
const stagingConfig: Config = {
  apiUrl: 'https://staging-api.sewsuite.com/api',
  websocketUrl: 'wss://staging-ws.sewsuite.com',
  environment: 'staging',
  sentryDsn: 'https://YOUR_SENTRY_DSN_STAGING',
  ...coreConfig,
  featureFlags: {
    enableAnalytics: true,
    enableChat: true,
    enableNotifications: true,
  },
  securityConfig: {
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://api.sewsuite.com", "https://js.stripe.com"],
      connectSrc: ["'self'", "https://api.sewsuite.com", "wss://ws.sewsuite.com"],
      imgSrc: ["'self'", "https://storage.sewsuite.com", "data:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  allowedOrigins: ['https://staging.sewsuite.com'],
  securityHeaders: {
    strictTransportSecurity: '',
    xContentTypeOptions: '',
    xFrameOptions: '',
    referrerPolicy: '',
    permissionsPolicy: '',
  },
};

// Production environment configuration
const prodConfig: Config = {
  apiUrl: 'https://api.sewsuite.co/api',
  websocketUrl: 'wss://ws.sewsuite.co',
  environment: 'production',
  sentryDsn: process.env.REACT_APP_SENTRY_DSN,
  googleAnalyticsId: process.env.REACT_APP_GA_ID,
  stripePublicKey: process.env.REACT_APP_STRIPE_PUBLIC_KEY,
  ...coreConfig,
  featureFlags: {
    enableAnalytics: true,
    enableChat: true,
    enableNotifications: true,
  },
  securityConfig: {
    contentSecurityPolicy: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://api.sewsuite.com", "https://js.stripe.com"],
      connectSrc: ["'self'", "https://api.sewsuite.com", "wss://ws.sewsuite.com"],
      imgSrc: ["'self'", "https://storage.sewsuite.com", "data:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  allowedOrigins: ['https://sewsuite.com', 'https://www.sewsuite.com'],
  securityHeaders: {
    strictTransportSecurity: 'max-age=63072000; includeSubDomains; preload',
    xContentTypeOptions: 'nosniff',
    xFrameOptions: 'DENY',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: 'camera=(), microphone=(), geolocation=()',
  },
};

// Determine which config to use based on environment variable
// More secure environment detection
const getConfig = (): Config => {
  // Only trust REACT_APP_ENV from build time, not runtime
  const env = process.env.REACT_APP_ENV;
  
  // Add validation to prevent unexpected environments
  const validEnvs = ['development', 'staging', 'production'];
  const safeEnv = validEnvs.includes(env as string) ? env : 'development';
  
  switch (safeEnv) {
    case 'production':
      return prodConfig;
    case 'staging':
      return stagingConfig;
    default:
      // Additional runtime check for security
      if (window.location.hostname !== 'localhost' && 
          !window.location.hostname.includes('127.0.0.1') &&
          process.env.NODE_ENV === 'production') {
        console.warn('Production build running in development mode - check configuration');
      }
      return devConfig;
  }
};

// Check for local overrides
const applyLocalOverrides = (config: Config): Config => {
  const apiUrl = process.env.REACT_APP_API_URL || config.apiUrl;
  
  return {
    ...config,
    // Ensure API URL has version in path
    apiUrl: `${apiUrl}/${config.apiVersion}`,
    websocketUrl: process.env.REACT_APP_WS_URL || config.websocketUrl,
  };
};

// Export the final config
const config = applyLocalOverrides(getConfig());
export default config;