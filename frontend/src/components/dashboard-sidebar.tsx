"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import {
  LayoutDashboard,
  ShoppingBag,
  Calendar,
  FileText,
  Megaphone,
  BarChart3,
  Globe,
  Palette,
  CreditCard,
  Truck,
  Settings,
  Puzzle,
  User,
  Users,
  Store,
} from "lucide-react"

export function DashboardSidebar() {
  const { user } = useAuth()
  const pathname = usePathname()

  const isActive = (path: string) => {
    return pathname === path
  }

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/orders", label: "My Sales", icon: ShoppingBag },
    { path: "/catalog", label: "Orders", icon: ShoppingBag },
    { path: "/calendar", label: "Calendar", icon: Calendar },
    { path: "/files", label: "Files", icon: FileText },
    { path: "/marketing", label: "Marketing", icon: Megaphone },
    { path: "/reports", label: "Reports", icon: BarChart3 },
    { path: "/sales-channels", label: "Sales Channels", icon: Store, separator: true },
    { path: "/website", label: "Website", icon: Globe },
    { path: "/design", label: "Design", icon: Palette },
    { path: "/payment", label: "Payment", icon: CreditCard },
    { path: "/shipping", label: "Shipping & Pickup", icon: Truck },
    { path: "/settings", label: "Settings", icon: Settings },
    { path: "/apps", label: "Apps", icon: Puzzle },
    { path: "/pricing", label: "Plans & Pricing", icon: CreditCard },
    { path: "/profile", label: "My Profile", icon: User },
    ...(user?.role === "admin" ? [{ path: "/admin/users", label: "User Management", icon: Users }] : []),
  ]

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-[calc(100vh-4rem)] p-4">
      <nav className="space-y-1">
        {navItems.map((item, index) => (
          <div key={item.path}>
            {item.separator && <div className="border-t border-slate-700 my-4" />}
            <Link
              href={item.path}
              className={`${
                isActive(item.path) ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              } group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors`}
            >
              <item.icon className="h-5 w-5 mr-3 flex-shrink-0" />
              {item.label}
            </Link>
          </div>
        ))}
      </nav>
    </aside>
  )
}
