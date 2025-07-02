import { Test, TestingModule } from '@nestjs/testing';
import { AppLoggerService } from '../app-logger.service';
import { ConfigService } from '@nestjs/config';

describe('AppLoggerService', () => {
  let service: AppLoggerService;
  let configServiceMock: any;

  // Spy on console methods
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    configServiceMock = {
      get: jest.fn((key) => {
        if (key === 'LOG_LEVEL') return 'debug';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppLoggerService,
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<AppLoggerService>(AppLoggerService);
    service.setContext('TestContext');
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('log', () => {
    it('should log a message with context', () => {
      service.log('Test log message');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TestContext]'),
        expect.stringContaining('Test log message'),
      );
    });

    it('should log object data', () => {
      const data = { id: 1, name: 'Test' };
      service.log('Test log with data', data);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TestContext]'),
        expect.stringContaining('Test log with data'),
        data,
      );
    });
  });

  describe('error', () => {
    it('should log an error message', () => {
      service.error('Test error');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TestContext]'),
        expect.stringContaining('Test error'),
      );
    });

    it('should log an error object', () => {
      const error = new Error('Test error message');
      service.error('Error occurred', error.stack);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TestContext]'),
        expect.stringContaining('Error occurred'),
        error.stack,
      );
    });
  });

  describe('warn', () => {
    it('should log a warning message', () => {
      service.warn('Test warning');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TestContext]'),
        expect.stringContaining('Test warning'),
      );
    });
  });

  describe('debug', () => {
    it('should log a debug message when log level is debug', () => {
      service.debug('Test debug message');
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TestContext]'),
        expect.stringContaining('[DEBUG]'),
        expect.stringContaining('Test debug message'),
      );
    });

    it('should not log debug messages when log level is higher', () => {
      // Override the log level
      jest.spyOn(configServiceMock, 'get').mockReturnValue('info');

      service.debug('This should not be logged');
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });
});
