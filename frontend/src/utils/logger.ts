type EventType = 'auth' | 'security' | 'error' | 'user' | 'system';
type EventSeverity = 'info' | 'warning' | 'error' | 'critical';

interface LogEvent {
  type: EventType;
  severity: EventSeverity;
  message: string;
  data?: any;
  timestamp: string;
}

const MAX_LOG_SIZE = 100;
const LOG_STORAGE_KEY = 'app_security_logs';

export const logEvent = (
  type: EventType, 
  severity: EventSeverity, 
  message: string, 
  data?: any
): void => {
  try {
    // Create event object
    const event: LogEvent = {
      type,
      severity,
      message,
      data,
      timestamp: new Date().toISOString()
    };
    
    // Store locally
    let logs: LogEvent[] = [];
    const storedLogs = localStorage.getItem(LOG_STORAGE_KEY);
    
    if (storedLogs) {
      logs = JSON.parse(storedLogs);
    }
    
    // Add new event and limit size
    logs.unshift(event);
    logs = logs.slice(0, MAX_LOG_SIZE);
    
    // Save back to storage
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
    
    // For critical events, also send to server if possible
    if (severity === 'critical' || severity === 'error') {
      sendLogToServer(event).catch(error => 
        console.error('Failed to send log to server:', error)
      );
    }
  } catch (error) {
    console.error('Error logging event:', error);
  }
};

// Send important logs to server
const sendLogToServer = async (event: LogEvent): Promise<void> => {
  // Implement when you have an endpoint for it
  // await post('/api/logs', event);
};

// Get logs for admin viewing
export const getSecurityLogs = (): LogEvent[] => {
  try {
    const storedLogs = localStorage.getItem(LOG_STORAGE_KEY);
    return storedLogs ? JSON.parse(storedLogs) : [];
  } catch (error) {
    console.error('Error retrieving logs:', error);
    return [];
  }
};

// Clear logs (for admin)
export const clearSecurityLogs = (): void => {
  localStorage.removeItem(LOG_STORAGE_KEY);
};