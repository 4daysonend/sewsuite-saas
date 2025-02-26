import 'reflect-metadata';
import { jest } from '@jest/globals';

// Global Jest timeout
jest.setTimeout(30000);

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.resetAllMocks();
});