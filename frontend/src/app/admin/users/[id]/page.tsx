"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { LoadingSpinner } from "@/components/loading-spinner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { type User, UserRole } from "@/components/user/user-management-dashboard"

export default function UserDetailPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const [userData, setUserData] = useState<User | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.push("/dashboard")
    }
  }, [loading, user, router])

  useEffect(() => {
    const fetchUser = async () => {
      if (!params.id) return

      try {
        setUserLoading(true)
        // In a real app, this would be an API call
        await new Promise((resolve) => setTimeout(resolve, 800))

        // Mock user data
        setUserData({
          id: params.id as string,
          email: `user${params.id}@example.com`,
          firstName: "John",
          lastName: "Doe",
          fullName: "John Doe",
          role: UserRole.CLIENT,
          displayRole: "Client",
          isActive: true,
          emailVerified: true,
          createdAt: new Date().toISOString(),
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load user")
      } finally {
        setUserLoading(false)
      }
    }

    fetchUser()
  }, [params.id])

  if (loading || userLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  if (!user || user.role !== "admin") return null

  if (error) {
    return (
      <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md" role="alert">
        <strong className="font-bold">Error!</strong>
        <span className="block sm:inline"> {error}</span>
      </div>
    )
  }

  if (!userData) return null

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-foreground">User Details</h1>
        <Button variant="outline" onClick={() => router.push("/admin/users")}>
          Back to Users
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>User Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center mb-6">
            <Avatar className="h-16 w-16 mr-4">
              <AvatarFallback className="text-lg">
                {userData.firstName?.[0]?.toUpperCase() || userData.email[0].toUpperCase()}
                {userData.lastName?.[0]?.toUpperCase() || ""}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold">
                {userData.fullName || `${userData.firstName || ""} ${userData.lastName || ""}`.trim() || "N/A"}
              </h2>
              <div className="flex space-x-2 mt-1">
                <Badge
                  variant="outline"
                  className={
                    userData.role === UserRole.ADMIN
                      ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100"
                      : userData.role === UserRole.TAILOR
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
                        : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                  }
                >
                  {userData.displayRole || userData.role}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    userData.isActive
                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                  }
                >
                  {userData.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Email</h3>
              <p className="mt-1 text-foreground">{userData.email}</p>
              <div className="mt-1">
                {userData.emailVerified ? (
                  <Badge
                    variant="outline"
                    className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                  >
                    Verified
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                  >
                    Not verified
                  </Badge>
                )}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Created</h3>
              <p className="mt-1 text-foreground">{new Date(userData.createdAt).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="mt-6 flex space-x-4">
            <Button onClick={() => router.push(`/admin/users/${userData.id}/edit`)}>Edit User</Button>
            <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10">
              Deactivate User
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
