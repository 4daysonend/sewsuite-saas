"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { LoadingSpinner } from "@/components/loading-spinner"
import { UserManagementDashboard } from "@/components/user/user-management-dashboard"

export default function AdminUsersPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.push("/dashboard")
    }
  }, [loading, user, router])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  if (!user || user.role !== "admin") return null

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground mb-6">User Management</h1>
      <UserManagementDashboard />
    </div>
  )
}
