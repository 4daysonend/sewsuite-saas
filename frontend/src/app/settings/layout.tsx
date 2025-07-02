"use client"

import type React from "react"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { LoadingSpinner } from "@/components/loading-spinner"
import { Settings, Calculator, FileText, Bell, Receipt, Users, Package } from "lucide-react"

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [loading, user, router])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  if (!user) return null

  const settingsNavItems = [
    {
      path: "/settings",
      label: "General",
      icon: Settings,
      exact: true,
    },
    {
      path: "/settings/taxes",
      label: "Taxes",
      icon: Calculator,
    },
    {
      path: "/settings/legal",
      label: "Legal",
      icon: FileText,
    },
    {
      path: "/settings/notifications",
      label: "Notifications",
      icon: Bell,
    },
    {
      path: "/settings/invoice",
      label: "Invoice",
      icon: Receipt,
    },
    {
      path: "/settings/customer-groups",
      label: "Customer Groups",
      icon: Users,
    },
    {
      path: "/settings/product",
      label: "Product",
      icon: Package,
    },
  ]

  const isActive = (path: string, exact?: boolean) => {
    if (exact) {
      return pathname === path
    }
    return pathname.startsWith(path)
  }

  return (
    <div className="flex gap-6">
      {/* Settings Sidebar */}
      <aside className="w-64 bg-white border rounded-lg p-4 h-fit">
        <h2 className="text-lg font-semibold mb-4">Settings</h2>
        <nav className="space-y-1">
          {settingsNavItems.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              className={`${
                isActive(item.path, item.exact)
                  ? "bg-primary/10 text-primary border-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              } flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors border-l-2 border-transparent`}
            >
              <item.icon className="h-4 w-4 mr-3" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Settings Content */}
      <div className="flex-1">{children}</div>
    </div>
  )
}
