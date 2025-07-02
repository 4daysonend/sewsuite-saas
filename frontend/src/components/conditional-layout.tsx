"use client"

import type React from "react"

import { usePathname } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { SiteHeader } from "@/components/site-header"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { LoadingSpinner } from "@/components/loading-spinner"

interface ConditionalLayoutProps {
  children: React.ReactNode
}

export function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const { user, loading } = useAuth()
  const pathname = usePathname()

  // Define public routes that don't need authentication
  const publicRoutes = ["/", "/login", "/register", "/forgot-password", "/reset-password"]

  // Check if current route is public
  const isPublicRoute = publicRoutes.includes(pathname)

  // Check if current route is a dashboard route (requires sidebar)
  const isDashboardRoute = !isPublicRoute && user

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  // For public routes, show simple layout without sidebar
  if (isPublicRoute) {
    return (
      <div className="relative flex min-h-screen flex-col bg-background">
        {user && <SiteHeader />}
        <main className={user ? "flex-1 py-6" : "flex-1"}>
          <div className={user ? "container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" : ""}>{children}</div>
        </main>
      </div>
    )
  }

  // For dashboard routes with authenticated user, show full layout with sidebar
  if (isDashboardRoute) {
    return (
      <div className="relative flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <div className="flex flex-1">
          <DashboardSidebar />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    )
  }

  // For protected routes without authentication, show simple layout
  // (the individual pages will handle redirecting to login)
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <main className="flex-1 py-6">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  )
}
