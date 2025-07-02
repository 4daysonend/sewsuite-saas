"use client"

import type React from "react"

import { useState } from "react"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Check } from "lucide-react"

interface UserSignupFormProps {
  formData: {
    firstName: string
    lastName: string
    email: string
    password: string
  }
  updateFormData: (data: Partial<UserSignupFormProps["formData"]>) => void
  onNext: () => void
}

export function UserSignupForm({ formData, updateFormData, onNext }: UserSignupFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.firstName.trim()) {
      newErrors.firstName = "First name is required"
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = "Last name is required"
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid"
    }

    if (!formData.password.trim()) {
      newErrors.password = "Password is required"
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (validateForm()) {
      onNext()
    }
  }

  return (
    <>
      <CardHeader>
        <CardTitle className="text-xl">Create your SewSuite account</CardTitle>
        <CardDescription>
          Enter your personal information to create your account and get started with SewSuite.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <div className="relative">
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => updateFormData({ firstName: e.target.value })}
                    placeholder="John"
                    className={`pr-10 ${errors.firstName ? "border-red-500" : ""}`}
                  />
                  {formData.firstName && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                      <Check className="h-5 w-5" />
                    </div>
                  )}
                </div>
                {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <div className="relative">
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => updateFormData({ lastName: e.target.value })}
                    placeholder="Doe"
                    className={`pr-10 ${errors.lastName ? "border-red-500" : ""}`}
                  />
                  {formData.lastName && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                      <Check className="h-5 w-5" />
                    </div>
                  )}
                </div>
                {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData({ email: e.target.value })}
                  placeholder="john.doe@example.com"
                  className={`pr-10 ${errors.email ? "border-red-500" : ""}`}
                />
                {formData.email && !errors.email && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                    <Check className="h-5 w-5" />
                  </div>
                )}
              </div>
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>

            <div>
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => updateFormData({ password: e.target.value })}
                  placeholder="••••••••"
                  className={`pr-10 ${errors.password ? "border-red-500" : ""}`}
                />
                {formData.password && !errors.password && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                    <Check className="h-5 w-5" />
                  </div>
                )}
              </div>
              {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
              <p className="text-xs text-gray-500 mt-1">Password must be at least 8 characters long</p>
            </div>
          </div>

          <Button type="submit" className="w-full md:w-auto">
            Next
          </Button>
        </form>
      </CardContent>
    </>
  )
}
