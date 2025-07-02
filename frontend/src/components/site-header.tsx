"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Menu, X, HelpCircle, MoveUpIcon as Upgrade } from "lucide-react"

export function SiteHeader() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const isActive = (path: string) => {
    return pathname === path
  }

  const getInitials = () => {
    if (user?.firstName) return user.firstName[0]
    if (user?.email) return user.email[0].toUpperCase()
    return "U"
  }

  // Only show navigation items when user is authenticated
  const navItems = user
    ? [
        { path: "/dashboard", label: "Dashboard" },
        { path: "/orders", label: "My Sales" },
        { path: "/catalog", label: "Orders" },
        { path: "/calendar", label: "Calendar" },
        { path: "/files", label: "Files" },
        { path: "/marketing", label: "Marketing" },
        { path: "/reports", label: "Reports" },
        { path: "/sales-channels", label: "Sales Channels" },
        { path: "/website", label: "Website" },
        { path: "/design", label: "Design" },
        { path: "/payment", label: "Payment" },
        { path: "/shipping", label: "Shipping & Pickup" },
        { path: "/settings", label: "Settings" },
        { path: "/apps", label: "Apps" },
        { path: "/profile", label: "My Profile" },
        { path: "/pricing", label: "Plans & Pricing" },
        ...(user?.role === "admin" ? [{ path: "/admin/users", label: "User Management" }] : []),
      ]
    : []

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background">
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex items-center">
          <Link href={user ? "/dashboard" : "/"} className="flex items-center mr-6">
            <div className="relative h-8 w-8 mr-2">
              <div className="absolute inset-0 bg-primary rounded-md flex items-center justify-center text-white text-xs font-bold">
                SS
              </div>
            </div>
            <span className="text-primary font-bold text-xl">SewSuite</span>
          </Link>
        </div>

        {/* Show different content based on authentication status */}
        {user ? (
          <>
            {/* Desktop Actions for authenticated users */}
            <div className="hidden md:flex items-center space-x-4">
              <Badge variant="secondary" className="bg-green-100 text-green-800" asChild>
                <Link href="/pricing" className="cursor-pointer">
                  <Upgrade className="h-3 w-3 mr-1" />
                  Upgrade
                </Link>
              </Badge>
              <Button variant="ghost" size="sm">
                <HelpCircle className="h-4 w-4 mr-2" />
                Get Help
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8 bg-primary/10">
                      <AvatarFallback className="text-primary">{getInitials()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-4 py-2 text-sm">
                    <p className="font-medium">{user?.fullName || user?.email}</p>
                    <p className="text-muted-foreground text-xs">{user?.email}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer">
                      Your Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout} className="cursor-pointer">
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile menu button for authenticated users */}
            <div className="flex md:hidden">
              <Button variant="ghost" size="icon" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Toggle menu">
                {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </Button>
            </div>
          </>
        ) : (
          /* Actions for non-authenticated users */
          <div className="flex items-center space-x-4">
            <Button asChild variant="ghost">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Get Started</Link>
            </Button>
          </div>
        )}
      </div>

      {/* Mobile menu - only show for authenticated users */}
      {user && isMenuOpen && (
        <div className="md:hidden border-t">
          <div className="space-y-1 px-4 py-2">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`${
                  isActive(item.path)
                    ? "bg-primary/10 border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:bg-muted hover:border-muted hover:text-foreground"
                } block px-3 py-2 border-l-4 text-sm font-medium transition-colors`}
                onClick={() => setIsMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="border-t px-4 py-2">
            <div className="flex items-center space-x-3 mb-3">
              <Avatar className="h-8 w-8 bg-primary/10">
                <AvatarFallback className="text-primary">{getInitials()}</AvatarFallback>
              </Avatar>
              <div>
                <div className="text-sm font-medium">{user?.fullName || user?.email}</div>
                <div className="text-xs text-muted-foreground">{user?.email}</div>
              </div>
            </div>
            <div className="space-y-1">
              <Button variant="ghost" size="sm" className="w-full justify-start">
                <HelpCircle className="h-4 w-4 mr-2" />
                Get Help
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
                Sign out
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
