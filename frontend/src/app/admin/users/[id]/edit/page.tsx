"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { LoadingSpinner } from "@/components/loading-spinner"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { type User, UserRole } from "@/components/user/user-management-dashboard"

export default function EditUserPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams()
  const [userData, setUserData] = useState<User | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    role: "",
    isActive: true,
  })

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
        const mockUser = {
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
        }

        setUserData(mockUser)
        setFormData({
          firstName: mockUser.firstName || "",
          lastName: mockUser.lastName || "",
          email: mockUser.email,
          role: mockUser.role,
          isActive: mockUser.isActive,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load user")
      } finally {
        setUserLoading(false)
      }
    }

    fetchUser()
  }, [params.id])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      [name]: checked,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      // In a real app, this would be an API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Success - redirect back to user details
      router.push(`/admin/users/${params.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save user")
      setIsSaving(false)
    }
  }

  if (loading || userLoading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  if (!user || user.role !== "admin") return null

  if (error && !isSaving) {
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
        <h1 className="text-2xl font-semibold text-foreground">Edit User</h1>
        <Button variant="outline" onClick={() => router.push(`/admin/users/${params.id}`)}>
          Cancel
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Edit User Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" name="firstName" value={formData.firstName} onChange={handleInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" name="lastName" value={formData.lastName} onChange={handleInputChange} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={formData.role} onValueChange={(value) => handleSelectChange("role", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UserRole.CLIENT}>Client</SelectItem>
                    <SelectItem value={UserRole.TAILOR}>Tailor</SelectItem>
                    <SelectItem value={UserRole.ADMIN}>Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="isActive" className="block mb-2">
                  Active Status
                </Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) => handleSwitchChange("isActive", checked)}
                  />
                  <Label htmlFor="isActive">{formData.isActive ? "Active" : "Inactive"}</Label>
                </div>
              </div>
            </div>

            {error && isSaving && (
              <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md" role="alert">
                <span>{error}</span>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button type="button" variant="outline" onClick={() => router.push(`/admin/users/${params.id}`)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <LoadingSpinner size="small" /> : "Save Changes"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}
