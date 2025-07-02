"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/components/auth-provider"
import { LoadingSpinner } from "@/components/loading-spinner"
import { ArrowLeft, CreditCard, Shield, Crown, Check } from "lucide-react"
import Link from "next/link"

export default function CheckoutPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly")
  const [paymentMethod, setPaymentMethod] = useState<"card" | "paypal">("card")
  const [cardDetails, setCardDetails] = useState({
    cardNumber: "",
    cardName: "",
    expiryMonth: "",
    expiryYear: "",
    cvv: "",
  })
  const [billingAddress, setBillingAddress] = useState({
    country: "United States",
    address: "",
    city: "",
    state: "",
    zipCode: "",
  })
  const [processing, setProcessing] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Get plan and feature from URL params
  const selectedPlan = searchParams.get("plan") || "professional"
  const selectedFeature = searchParams.get("feature")
  const urlBilling = searchParams.get("billing") as "monthly" | "yearly"

  useEffect(() => {
    if (urlBilling) {
      setBillingCycle(urlBilling)
    }
  }, [urlBilling])

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login?redirect=/checkout")
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

  const plans = {
    starter: {
      name: "Starter",
      monthlyPrice: 0,
      yearlyPrice: 0,
      features: ["Limited pattern storage", "Basic client management", "Email support"],
    },
    sewist: {
      name: "Sewist",
      monthlyPrice: 19.99,
      yearlyPrice: 199.99,
      features: ["25 patterns", "10 clients", "Basic analytics", "PDF invoices"],
    },
    studio: {
      name: "Studio",
      monthlyPrice: 49.99,
      yearlyPrice: 499.99,
      features: ["100 patterns", "50 clients", "Payment processing", "Client portal"],
    },
    atelier: {
      name: "Atelier",
      monthlyPrice: 99.99,
      yearlyPrice: 999.99,
      features: ["Unlimited patterns", "Unlimited clients", "Team accounts", "API access"],
    },
  }

  const currentPlan = plans[selectedPlan as keyof typeof plans] || plans.studio

  const featureDescriptions = {
    "tax-automation": "Automatic tax calculation with real-time rates",
    "tax-reporting": "Advanced tax reporting and compliance tools",
    "multi-location": "Multi-location tax management",
    "sms-notifications": "SMS notifications and reminders",
    "push-notifications": "Mobile push notifications",
    "email-templates": "Custom email template designer",
    "advanced-notifications": "A/B testing and notification analytics",
    "customer-groups": "Advanced customer segmentation",
    "auto-segmentation": "AI-powered customer segmentation",
    "group-analytics": "Customer group analytics and insights",
    "targeted-campaigns": "Targeted marketing campaigns",
    "lifecycle-management": "Customer lifecycle management",
  }

  const price = billingCycle === "yearly" ? currentPlan.yearlyPrice : currentPlan.monthlyPrice
  const taxRate = 0.0888
  const taxAmount = Number((price * taxRate).toFixed(2))
  const totalAmount = Number((price + taxAmount).toFixed(2))

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (paymentMethod === "card") {
      if (!cardDetails.cardNumber.trim()) {
        newErrors.cardNumber = "Card number is required"
      }
      if (!cardDetails.cardName.trim()) {
        newErrors.cardName = "Name on card is required"
      }
      if (!cardDetails.expiryMonth) {
        newErrors.expiryMonth = "Expiry month is required"
      }
      if (!cardDetails.expiryYear) {
        newErrors.expiryYear = "Expiry year is required"
      }
      if (!cardDetails.cvv.trim()) {
        newErrors.cvv = "CVV is required"
      }
    }

    if (!billingAddress.address.trim()) {
      newErrors.address = "Address is required"
    }
    if (!billingAddress.city.trim()) {
      newErrors.city = "City is required"
    }
    if (!billingAddress.state.trim()) {
      newErrors.state = "State is required"
    }
    if (!billingAddress.zipCode.trim()) {
      newErrors.zipCode = "ZIP code is required"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setProcessing(true)

    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Redirect to success page
    router.push(`/checkout/success?plan=${selectedPlan}&billing=${billingCycle}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/pricing"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to pricing
          </Link>
          <h1 className="text-3xl font-bold">Complete your purchase</h1>
          <p className="text-muted-foreground">Upgrade to unlock powerful features for your sewing business</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Order Summary */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Crown className="h-5 w-5 mr-2 text-yellow-500" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{currentPlan.name} Plan</h3>
                    <p className="text-sm text-muted-foreground">
                      Billed {billingCycle === "yearly" ? "annually" : "monthly"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      $
                      {billingCycle === "yearly"
                        ? (currentPlan.yearlyPrice / 12).toFixed(2)
                        : currentPlan.monthlyPrice.toFixed(2)}
                      /mo
                    </div>
                    {billingCycle === "yearly" && (
                      <Badge variant="secondary" className="text-xs">
                        Save 17%
                      </Badge>
                    )}
                  </div>
                </div>

                {selectedFeature && (
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">
                          Featured: {featureDescriptions[selectedFeature as keyof typeof featureDescriptions]}
                        </h4>
                        <p className="text-sm text-muted-foreground">Included in {currentPlan.name} plan</p>
                      </div>
                      <Check className="h-5 w-5 text-green-500" />
                    </div>
                  </div>
                )}

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>${price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Tax (8.88%)</span>
                    <span>${taxAmount.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total</span>
                    <span>${totalAmount.toFixed(2)}</span>
                  </div>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">What's included:</h4>
                  <ul className="space-y-1">
                    {currentPlan.features.map((feature, index) => (
                      <li key={index} className="flex items-center text-sm">
                        <Check className="h-4 w-4 mr-2 text-green-500" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Billing Cycle Toggle */}
            <Card>
              <CardHeader>
                <CardTitle>Billing Cycle</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup
                  value={billingCycle}
                  onValueChange={(value: "monthly" | "yearly") => setBillingCycle(value)}
                >
                  <div className="flex items-center space-x-2 border rounded-lg p-4">
                    <RadioGroupItem value="monthly" id="monthly" />
                    <Label htmlFor="monthly" className="flex-1 cursor-pointer">
                      <div className="font-medium">Monthly</div>
                      <div className="text-sm text-muted-foreground">${currentPlan.monthlyPrice}/month</div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-4">
                    <RadioGroupItem value="yearly" id="yearly" />
                    <Label htmlFor="yearly" className="flex-1 cursor-pointer">
                      <div className="font-medium flex items-center">
                        Annual
                        <Badge variant="secondary" className="ml-2">
                          Save 17%
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ${(currentPlan.yearlyPrice / 12).toFixed(2)}/month (billed ${currentPlan.yearlyPrice}/year)
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>
          </div>

          {/* Payment Form */}
          <div className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Payment Method */}
              <Card>
                <CardHeader>
                  <CardTitle>Payment Method</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={(value: "card" | "paypal") => setPaymentMethod(value)}
                  >
                    <div className="flex items-center space-x-2 border rounded-lg p-4">
                      <RadioGroupItem value="card" id="card" />
                      <Label htmlFor="card" className="flex items-center cursor-pointer">
                        <CreditCard className="h-5 w-5 mr-2" />
                        Credit or Debit Card
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2 border rounded-lg p-4">
                      <RadioGroupItem value="paypal" id="paypal" />
                      <Label htmlFor="paypal" className="cursor-pointer">
                        PayPal
                      </Label>
                    </div>
                  </RadioGroup>

                  {paymentMethod === "card" && (
                    <div className="space-y-4 pt-4 border-t">
                      <div>
                        <Label htmlFor="cardNumber">Card Number</Label>
                        <Input
                          id="cardNumber"
                          placeholder="1234 5678 9012 3456"
                          value={cardDetails.cardNumber}
                          onChange={(e) => setCardDetails((prev) => ({ ...prev, cardNumber: e.target.value }))}
                          className={errors.cardNumber ? "border-red-500" : ""}
                        />
                        {errors.cardNumber && <p className="text-red-500 text-sm mt-1">{errors.cardNumber}</p>}
                      </div>

                      <div>
                        <Label htmlFor="cardName">Name on Card</Label>
                        <Input
                          id="cardName"
                          placeholder="John Doe"
                          value={cardDetails.cardName}
                          onChange={(e) => setCardDetails((prev) => ({ ...prev, cardName: e.target.value }))}
                          className={errors.cardName ? "border-red-500" : ""}
                        />
                        {errors.cardName && <p className="text-red-500 text-sm mt-1">{errors.cardName}</p>}
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="expiryMonth">Month</Label>
                          <Select
                            value={cardDetails.expiryMonth}
                            onValueChange={(value) => setCardDetails((prev) => ({ ...prev, expiryMonth: value }))}
                          >
                            <SelectTrigger className={errors.expiryMonth ? "border-red-500" : ""}>
                              <SelectValue placeholder="MM" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 12 }, (_, i) => {
                                const month = i + 1
                                return (
                                  <SelectItem key={month} value={month.toString().padStart(2, "0")}>
                                    {month.toString().padStart(2, "0")}
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                          {errors.expiryMonth && <p className="text-red-500 text-sm mt-1">{errors.expiryMonth}</p>}
                        </div>
                        <div>
                          <Label htmlFor="expiryYear">Year</Label>
                          <Select
                            value={cardDetails.expiryYear}
                            onValueChange={(value) => setCardDetails((prev) => ({ ...prev, expiryYear: value }))}
                          >
                            <SelectTrigger className={errors.expiryYear ? "border-red-500" : ""}>
                              <SelectValue placeholder="YYYY" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: 10 }, (_, i) => {
                                const year = new Date().getFullYear() + i
                                return (
                                  <SelectItem key={year} value={year.toString()}>
                                    {year}
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                          {errors.expiryYear && <p className="text-red-500 text-sm mt-1">{errors.expiryYear}</p>}
                        </div>
                        <div>
                          <Label htmlFor="cvv">CVV</Label>
                          <Input
                            id="cvv"
                            placeholder="123"
                            value={cardDetails.cvv}
                            onChange={(e) => setCardDetails((prev) => ({ ...prev, cvv: e.target.value }))}
                            className={errors.cvv ? "border-red-500" : ""}
                          />
                          {errors.cvv && <p className="text-red-500 text-sm mt-1">{errors.cvv}</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Billing Address */}
              <Card>
                <CardHeader>
                  <CardTitle>Billing Address</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="country">Country</Label>
                    <Select
                      value={billingAddress.country}
                      onValueChange={(value) => setBillingAddress((prev) => ({ ...prev, country: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="United States">United States</SelectItem>
                        <SelectItem value="Canada">Canada</SelectItem>
                        <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                        <SelectItem value="Australia">Australia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="address">Address</Label>
                    <Input
                      id="address"
                      placeholder="123 Main Street"
                      value={billingAddress.address}
                      onChange={(e) => setBillingAddress((prev) => ({ ...prev, address: e.target.value }))}
                      className={errors.address ? "border-red-500" : ""}
                    />
                    {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        placeholder="New York"
                        value={billingAddress.city}
                        onChange={(e) => setBillingAddress((prev) => ({ ...prev, city: e.target.value }))}
                        className={errors.city ? "border-red-500" : ""}
                      />
                      {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
                    </div>
                    <div>
                      <Label htmlFor="state">State</Label>
                      <Input
                        id="state"
                        placeholder="NY"
                        value={billingAddress.state}
                        onChange={(e) => setBillingAddress((prev) => ({ ...prev, state: e.target.value }))}
                        className={errors.state ? "border-red-500" : ""}
                      />
                      {errors.state && <p className="text-red-500 text-sm mt-1">{errors.state}</p>}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="zipCode">ZIP Code</Label>
                    <Input
                      id="zipCode"
                      placeholder="10001"
                      value={billingAddress.zipCode}
                      onChange={(e) => setBillingAddress((prev) => ({ ...prev, zipCode: e.target.value }))}
                      className={errors.zipCode ? "border-red-500" : ""}
                    />
                    {errors.zipCode && <p className="text-red-500 text-sm mt-1">{errors.zipCode}</p>}
                  </div>
                </CardContent>
              </Card>

              {/* Security Notice */}
              <div className="flex items-center p-4 bg-green-50 rounded-lg border border-green-200">
                <Shield className="h-5 w-5 text-green-600 mr-3" />
                <div className="text-sm">
                  <p className="font-medium text-green-800">Secure Payment</p>
                  <p className="text-green-700">Your payment information is encrypted and secure</p>
                </div>
              </div>

              {/* Submit Button */}
              <Button type="submit" className="w-full h-12 text-lg" disabled={processing}>
                {processing ? (
                  <>
                    <LoadingSpinner size="small" className="mr-2" />
                    Processing...
                  </>
                ) : (
                  `Complete Purchase - $${totalAmount.toFixed(2)}`
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
