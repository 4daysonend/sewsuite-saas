"use client"

import { useState, useEffect } from "react"

type StorageQuota = {
  used: number
  total: number
  percentage: number
}

export function useStorageQuota() {
  const [quota, setQuota] = useState<StorageQuota | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchQuota = async () => {
      setLoading(true)
      try {
        // In a real app, you would fetch this data from an API
        // This is just a mock implementation
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // Mock data
        const mockQuota: StorageQuota = {
          used: 2.5 * 1024 * 1024 * 1024, // 2.5GB
          total: 10 * 1024 * 1024 * 1024, // 10GB
          percentage: 25,
        }

        setQuota(mockQuota)
      } catch (error) {
        console.error("Error fetching storage quota:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchQuota()
  }, [])

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"

    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  return { quota, loading, formatBytes }
}
