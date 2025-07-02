import { isProd, isDev, isTest } from '../utils/environment';

/**
 * This factory function helps choose between real and mock implementations
 * based on environment or explicit configuration.
 */
export function createServiceFactory<RealService, MockService>(
  realImplementation: RealService,
  mockImplementation: MockService,
  options: {
    forceMock?: boolean,
    forceReal?: boolean,
    mockInDev?: boolean,
    mockInTest?: boolean
  } = {}
) {
  // Default behavior: use mock in test, real in other environments
  const useMock = options.forceMock || 
    (options.mockInTest && isTest) || 
    (options.mockInDev && isDev);
    
  const useReal = options.forceReal || isProd;
  
  // Real implementation takes precedence if both flags are set
  return useReal ? realImplementation : (useMock ? mockImplementation : realImplementation);
}