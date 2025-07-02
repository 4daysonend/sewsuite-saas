"use client"

import type React from "react"

import { useState } from "react"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Check } from "lucide-react"

interface StoreSetupFormProps {
  formData: {
    storeName: string
    country: string
    currency: string
  }
  updateFormData: (data: Partial<StoreSetupFormProps["formData"]>) => void
  onNext: () => void
  onBack: () => void
}

export function StoreSetupForm({ formData, updateFormData, onNext, onBack }: StoreSetupFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.storeName.trim()) {
      newErrors.storeName = "Store name is required"
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
        <CardTitle className="text-xl">Get a head start on your store setup.</CardTitle>
        <CardDescription>
          We'll guide you through the essential steps to set up your SewSuite online store.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="storeName">What's your store name?</Label>
              <div className="text-sm text-gray-500 mb-2">
                Enter the name of your store as you want it to appear to your customers. You can change the name of your
                store at any time later.
              </div>
              <div className="relative">
                <Input
                  id="storeName"
                  value={formData.storeName}
                  onChange={(e) => updateFormData({ storeName: e.target.value })}
                  placeholder="My Sewing Shop"
                  className={`pr-10 ${errors.storeName ? "border-red-500" : ""}`}
                />
                {formData.storeName && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                    <Check className="h-5 w-5" />
                  </div>
                )}
              </div>
              {errors.storeName && <p className="text-red-500 text-sm mt-1">{errors.storeName}</p>}
            </div>

            <div>
              <Label>What's your country and currency?</Label>
              <div className="text-sm text-gray-500 mb-2">Confirm that we guessed your regional settings right.</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <Select value={formData.country} onValueChange={(value) => updateFormData({ country: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="United States">United States</SelectItem>
                      <SelectItem value="Canada">Canada</SelectItem>
                      <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                      <SelectItem value="Australia">Australia</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="absolute right-10 top-1/2 -translate-y-1/2 text-green-500">
                    <Check className="h-5 w-5" />
                  </div>
                </div>
                <div className="relative">
                  <Select value={formData.currency} onValueChange={(value) => updateFormData({ currency: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="U.S. dollar">U.S. dollar</SelectItem>
                      <SelectItem value="Euro">Euro</SelectItem>
                      <SelectItem value="British pound">British pound</SelectItem>
                      <SelectItem value="Canadian dollar">Canadian dollar</SelectItem>
                      <SelectItem value="Australian dollar">Australian dollar</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="absolute right-10 top-1/2 -translate-y-1/2 text-green-500">
                    <Check className="h-5 w-5" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button type="submit">Next</Button>
          </div>
        </form>
      </CardContent>
    </>
  )
}
