// sewsuite-saas\frontend\src\hooks\useMetrics.ts (updated)
import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { SystemMetrics } from '../types/monitoring';

export const useMetrics = (timeframe: string) => {
  const [data, setData] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    // Initialize socket connection
    socketRef.current = io('/monitoring', {
      auth: {
        token,
        userId: localStorage.getItem('userId')
      }
    });

    // Handle socket events
    socketRef.current.on('connect', () => {
      setError(null);
      socketRef.current?.emit('setTimeframe', timeframe);
    });

    socketRef.current.on('metrics', (metrics: SystemMetrics) => {
      setData(metrics);
      setLoading(false);
    });

    socketRef.current.on('connect_error', (err) => {
      setError(`Connection error: ${err.message}`);
      setLoading(false);
    });

    // Cleanup
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  // Handle timeframe changes
  useEffect(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('setTimeframe', timeframe);
    }
  }, [timeframe]);

  return { data, loading, error };
};