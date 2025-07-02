"use client"

import { useState, useEffect } from "react"

// Define types for metrics data
export type SystemStatus = "healthy" | "degraded" | "unhealthy"

export interface TimelineEntry {
  timestamp: string
  cpu: number
  memory: number
}

export interface PerformanceMetrics {
  cpu: number
  memory: number
  activeConnections: number
  timeline: TimelineEntry[]
}

export interface SystemMetrics {
  status: SystemStatus
  uptime: number
  performance: PerformanceMetrics
  services: {
    name: string
    status: SystemStatus
    responseTime: number
  }[]
}

export function useMetrics() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true)
        // In a real app, this would be an API call
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // Mock metrics data
        const mockMetrics: SystemMetrics = {
          status: "healthy",
          uptime: 86400, // 24 hours in seconds
          performance: {
            cpu: 32,
            memory: 45,
            activeConnections: 24,
            timeline: Array.from({ length: 24 }, (_, i) => ({
              timestamp: new Date(Date.now() - (23 - i) * 3600000).toISOString(),
              cpu: 20 + Math.floor(Math.random() * 30),
              memory: 30 + Math.floor(Math.random() * 30),
            })),
          },
          services: [
            {
              name: "API Server",
              status: "healthy",
              responseTime: 120,
            },
            {
              name: "Database",
              status: "healthy",
              responseTime: 85,
            },
            {
              name: "Storage Service",
              status: "degraded",
              responseTime: 350,
            },
          ],
        }

        setMetrics(mockMetrics)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch system metrics")
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [])

  return { metrics, loading, error }
}
