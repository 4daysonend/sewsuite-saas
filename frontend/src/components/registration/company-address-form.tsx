"use client"

import type React from "react"

import { useState } from "react"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Check } from "lucide-react"

interface CompanyAddressFormProps {
  formData: {
    address: string
    city: string
    zipCode: string
  }
  updateFormData: (data: Partial<CompanyAddressFormProps["formData"]>) => void
  onNext: () => void
  onBack: () => void
}

export function CompanyAddressForm({ formData, updateFormData, onNext, onBack }: CompanyAddressFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.address.trim()) {
      newErrors.address = "Address is required"
    }

    if (!formData.zipCode.trim()) {
      newErrors.zipCode = "ZIP/Postal Code is required"
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
        <CardTitle className="text-xl">Add a company address to get paid and set up delivery.</CardTitle>
        <CardDescription>
          This address is required to get your SewSuite store ready for receiving payments and setting up delivery.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="address">What's your company address?</Label>
              <div className="text-sm text-gray-500 mb-2">
                This is the address where your company and store are located. If you don't have a company address yet,
                please use your address from where you will be shipping your orders.
              </div>
              <div className="relative">
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => updateFormData({ address: e.target.value })}
                  placeholder="123 Main St"
                  className={errors.address ? "border-red-500" : ""}
                />
              </div>
              {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <div className="relative">
                  <Select value={formData.city} onValueChange={(value) => updateFormData({ city: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="New York">New York</SelectItem>
                      <SelectItem value="Los Angeles">Los Angeles</SelectItem>
                      <SelectItem value="Chicago">Chicago</SelectItem>
                      <SelectItem value="Houston">Houston</SelectItem>
                      <SelectItem value="Phoenix">Phoenix</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="absolute right-10 top-1/2 -translate-y-1/2 text-green-500">
                    <Check className="h-5 w-5" />
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="zipCode">ZIP/Postal Code</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) => updateFormData({ zipCode: e.target.value })}
                  placeholder="10001"
                  className={errors.zipCode ? "border-red-500" : ""}
                />
                {errors.zipCode && <p className="text-red-500 text-sm mt-1">{errors.zipCode}</p>}
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
