"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LoadingSpinner } from "@/components/loading-spinner"

export default function GeneralSettingsPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    storeName: "SewSuite Store",
    storeUrl: "https://sewsuite.com/store/products",
    companyName: "SewSuite",
    companyEmail: "contact@sewsuite.com",
    phoneNumber: "",
    streetAddress: "",
    city: "Miami",
    state: "Florida",
    zipCode: "33101",
    country: "United States",
    facebook: "",
    instagram: "",
    twitter: "",
    youtube: "",
    pinterest: "",
    tiktok: "",
  })

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))
      // Handle success
    } catch (error) {
      console.error("Failed to save settings:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">General Settings</h1>
        <div className="flex space-x-4 mt-2 text-sm">
          <span className="text-primary border-b-2 border-primary pb-1">Store Profile</span>
          <span className="text-muted-foreground">Regional Settings</span>
          <span className="text-muted-foreground">Cart & Checkout</span>
          <span className="text-muted-foreground">Tracking & Analytics</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Store name and web address */}
        <Card>
          <CardHeader>
            <CardTitle>Store name and web address</CardTitle>
            <p className="text-sm text-muted-foreground">
              Your store name is displayed in customer-facing locations to customers. Your store web address is
              displayed on customer-facing invoices and emails, and in also used when sharing products via social
              networks.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="storeName">Store name</Label>
              <Input
                id="storeName"
                value={formData.storeName}
                onChange={(e) => handleInputChange("storeName", e.target.value)}
                placeholder="SewSuite Store"
              />
              <p className="text-xs text-muted-foreground">
                The name of your store as you want it to appear in your store's header, email notifications, and
                invoices.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="storeUrl">Store's web address (URL)</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="storeUrl"
                  value={formData.storeUrl}
                  onChange={(e) => handleInputChange("storeUrl", e.target.value)}
                  placeholder="https://sewsuite.com/store/products"
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="sm">
                  Edit
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Your own web address</Label>
              <div className="text-sm text-muted-foreground">
                Choose and buy a perfect domain name for your store.
                <Button variant="link" className="p-0 h-auto text-primary">
                  automatically connected to your Instant Site.
                </Button>
              </div>
              <Button type="button" className="bg-green-600 hover:bg-green-700 text-white">
                Upgrade to Get Address
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Company name, email address, and phone number */}
        <Card>
          <CardHeader>
            <CardTitle>Company name, email address, and phone number</CardTitle>
            <p className="text-sm text-muted-foreground">
              The official name of your company or organization that will be shown to customers in invoices and email
              notifications. If you don't have a registered business yet, leave this field empty or the company name.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company name</Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => handleInputChange("companyName", e.target.value)}
                placeholder="SewSuite"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyEmail">Company email address</Label>
              <Input
                id="companyEmail"
                type="email"
                value={formData.companyEmail}
                onChange={(e) => handleInputChange("companyEmail", e.target.value)}
                placeholder="contact@sewsuite.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Phone number</Label>
              <Input
                id="phoneNumber"
                value={formData.phoneNumber}
                onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
          </CardContent>
        </Card>

        {/* Company address */}
        <Card>
          <CardHeader>
            <CardTitle>Company address</CardTitle>
            <p className="text-sm text-muted-foreground">
              Your company's physical address is shown to customers in invoices and email notifications. If you ship
              orders from a different address, enter the shipping origin address in Shipping & Pickup. If you don't have
              a business address, enter the shipping origin address here.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="streetAddress">Street address</Label>
              <Input
                id="streetAddress"
                value={formData.streetAddress}
                onChange={(e) => handleInputChange("streetAddress", e.target.value)}
                placeholder="123 Main Street"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => handleInputChange("city", e.target.value)}
                placeholder="Miami"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="state">State/Province/Region</Label>
                <Select value={formData.state} onValueChange={(value) => handleInputChange("state", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Florida">Florida</SelectItem>
                    <SelectItem value="California">California</SelectItem>
                    <SelectItem value="New York">New York</SelectItem>
                    <SelectItem value="Texas">Texas</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="zipCode">Zip/Postal code</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) => handleInputChange("zipCode", e.target.value)}
                  placeholder="33101"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Select value={formData.country} onValueChange={(value) => handleInputChange("country", value)}>
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
            </div>
          </CardContent>
        </Card>

        {/* Social media accounts */}
        <Card>
          <CardHeader>
            <CardTitle>Social media accounts</CardTitle>
            <p className="text-sm text-muted-foreground">
              Specify your company's social media accounts to stay in touch with your target audience. These accounts
              are displayed to customers in email notifications sent by your store.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="facebook" className="flex items-center">
                <span className="text-blue-600 mr-2">📘</span>
                Facebook
              </Label>
              <Input
                id="facebook"
                value={formData.facebook}
                onChange={(e) => handleInputChange("facebook", e.target.value)}
                placeholder="https://facebook.com/yourpage"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instagram" className="flex items-center">
                <span className="text-pink-600 mr-2">📷</span>
                Instagram
              </Label>
              <Input
                id="instagram"
                value={formData.instagram}
                onChange={(e) => handleInputChange("instagram", e.target.value)}
                placeholder="https://instagram.com/yourusername"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="twitter" className="flex items-center">
                <span className="text-blue-400 mr-2">🐦</span>X
              </Label>
              <Input
                id="twitter"
                value={formData.twitter}
                onChange={(e) => handleInputChange("twitter", e.target.value)}
                placeholder="https://x.com/yourusername"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="youtube" className="flex items-center">
                <span className="text-red-600 mr-2">📺</span>
                YouTube
              </Label>
              <Input
                id="youtube"
                value={formData.youtube}
                onChange={(e) => handleInputChange("youtube", e.target.value)}
                placeholder="https://youtube.com/channel/yourchannel"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pinterest" className="flex items-center">
                <span className="text-red-500 mr-2">📌</span>
                Pinterest
              </Label>
              <Input
                id="pinterest"
                value={formData.pinterest}
                onChange={(e) => handleInputChange("pinterest", e.target.value)}
                placeholder="https://pinterest.com/yourprofile"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tiktok" className="flex items-center">
                <span className="mr-2">🎵</span>
                TikTok
              </Label>
              <Input
                id="tiktok"
                value={formData.tiktok}
                onChange={(e) => handleInputChange("tiktok", e.target.value)}
                placeholder="https://tiktok.com/@yourusername"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <LoadingSpinner size="small" /> : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  )
}
