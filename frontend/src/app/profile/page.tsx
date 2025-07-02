"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/components/auth-provider"
import { LoadingSpinner } from "@/components/loading-spinner"
import { Alert } from "@/components/ui/alert"
import { User, Mail, Lock, AlertTriangle, CheckCircle, Edit3, X } from "lucide-react"

export default function ProfilePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  // State for modals
  const [isNameEmailModalOpen, setIsNameEmailModalOpen] = useState(false)
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [isCloseAccountModalOpen, setIsCloseAccountModalOpen] = useState(false)

  // State for forms
  const [nameEmailForm, setNameEmailForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
  })

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [emailVerificationSent, setEmailVerificationSent] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [loading, user, router])

  useEffect(() => {
    if (user) {
      setNameEmailForm({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
      })
    }
  }, [user])

  const handleSendVerificationEmail = async () => {
    setIsSubmitting(true)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setEmailVerificationSent(true)
    } catch (error) {
      console.error("Failed to send verification email:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNameEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setIsNameEmailModalOpen(false)
      // In real app, update user context
    } catch (error) {
      console.error("Failed to update profile:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert("Passwords don't match")
      return
    }

    setIsSubmitting(true)
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setIsPasswordModalOpen(false)
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
    } catch (error) {
      console.error("Failed to change password:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  if (!user) return null

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Profile</h1>
            <p className="text-muted-foreground mt-1">Your profile</p>
            <p className="text-sm text-muted-foreground">See details profile details.</p>
          </div>
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>

        {/* Profile Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="h-5 w-5" />
              <span>Profile information</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Your profile information is used to sign in to the store. It is also shared with the support team when you
              contact them.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Info Display */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Name</Label>
                  <p className="text-foreground font-medium">
                    {user?.fullName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Not set"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                  <p className="text-foreground font-medium">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* Email Verification Status */}
            {!user?.emailVerified && (
              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <div className="text-yellow-800">
                  <div className="flex items-center justify-between">
                    <span>Your email address is not verified. Please check your inbox and verify your email.</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSendVerificationEmail}
                      disabled={isSubmitting || emailVerificationSent}
                    >
                      {isSubmitting ? <LoadingSpinner size="small" /> : emailVerificationSent ? "Sent!" : "Resend"}
                    </Button>
                  </div>
                </div>
              </Alert>
            )}

            {user?.emailVerified && (
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div className="text-green-800">Your email address is verified.</div>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="space-y-4">
              {/* Change Name and Email */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Edit3 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Change name and email</h3>
                    <p className="text-sm text-muted-foreground">
                      Change the profile name and email address that are used for sign-in.
                    </p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => setIsNameEmailModalOpen(true)}>
                  Change
                </Button>
              </div>

              {/* Change Password */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Lock className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">Change password</h3>
                    <p className="text-sm text-muted-foreground">Change your SewSuite account password.</p>
                  </div>
                </div>
                <Button variant="outline" onClick={() => setIsPasswordModalOpen(true)}>
                  Change
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Management */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span>Close profile</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">Permanently close your profile.</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
              <div>
                <h3 className="font-medium text-red-800">Close account</h3>
                <p className="text-sm text-red-600">
                  Your account will be closed permanently. Your SewSuite store will be shut down.
                </p>
              </div>
              <Button variant="destructive" onClick={() => setIsCloseAccountModalOpen(true)}>
                Close my account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Name and Email Modal */}
      {isNameEmailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsNameEmailModalOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Change name and email</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsNameEmailModalOpen(false)} className="h-6 w-6">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Your name is shared with the support team when you contact them.
            </p>
            <form onSubmit={handleNameEmailSubmit}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={nameEmailForm.firstName}
                    onChange={(e) => setNameEmailForm((prev) => ({ ...prev, firstName: e.target.value }))}
                    placeholder="Enter your first name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={nameEmailForm.lastName}
                    onChange={(e) => setNameEmailForm((prev) => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Enter your last name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={nameEmailForm.email}
                    onChange={(e) => setNameEmailForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="Enter your email"
                  />
                  <p className="text-xs text-muted-foreground">The email is used to sign in to your account.</p>
                </div>
                {nameEmailForm.email !== user?.email && (
                  <Alert className="border-blue-200 bg-blue-50">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <div className="text-blue-800 text-xs">
                      After changing the email, you will receive an email with the new address. You will receive an
                      email with the instructions.
                    </div>
                  </Alert>
                )}
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <Button type="button" variant="outline" onClick={() => setIsNameEmailModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <LoadingSpinner size="small" /> : "Save"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsPasswordModalOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Change password</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsPasswordModalOpen(false)} className="h-6 w-6">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Enter your current password and choose a new one.</p>
            <form onSubmit={handlePasswordSubmit}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                    placeholder="Enter current password"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                    placeholder="Enter new password"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm new password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                    placeholder="Confirm new password"
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <Button type="button" variant="outline" onClick={() => setIsPasswordModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <LoadingSpinner size="small" /> : "Save"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Account Modal */}
      {isCloseAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setIsCloseAccountModalOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-red-600">Close Account</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsCloseAccountModalOpen(false)} className="h-6 w-6">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to permanently close your account? This action cannot be undone.
            </p>
            <div className="mb-4">
              <Alert className="border-red-200 bg-red-50">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <div className="text-red-800">
                  <strong>Warning:</strong> This will permanently delete your account, all your patterns, client data,
                  and projects. This action cannot be reversed.
                </div>
              </Alert>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsCloseAccountModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" disabled={isSubmitting}>
                {isSubmitting ? <LoadingSpinner size="small" /> : "Yes, close my account"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
