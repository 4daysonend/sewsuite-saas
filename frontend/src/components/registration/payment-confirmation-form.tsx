"use client"

import type React from "react"

import { useState } from "react"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CreditCard } from "lucide-react"

interface PaymentConfirmationFormProps {
  formData: {
    planType: string
  }
  updateFormData: (data: Partial<PaymentConfirmationFormProps["formData"]>) => void
  onNext: () => void
  onBack: () => void
}

export function PaymentConfirmationForm({ formData, updateFormData, onNext, onBack }: PaymentConfirmationFormProps) {
  const [paymentMethod, setPaymentMethod] = useState<"card" | "other">("card")
  const [cardDetails, setCardDetails] = useState({
    cardNumber: "",
    cardName: "",
    expiryMonth: "",
    expiryYear: "",
    cvv: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Calculate prices
  const prices = {
    monthly: {
      base: 35,
      period: "monthly",
      total: 35,
    },
    annual: {
      base: 350,
      period: "annually",
      total: 350,
      savings: 70,
    },
  }

  const taxRate = 0.0888 // 8.88%
  const taxAmount = Number((prices[formData.planType as keyof typeof prices].total * taxRate).toFixed(2))
  const totalAmount = Number((prices[formData.planType as keyof typeof prices].total + taxAmount).toFixed(2))

  const validateForm = () => {
    if (paymentMethod !== "card") return true

    const newErrors: Record<string, string> = {}

    if (!cardDetails.cardNumber.trim()) {
      newErrors.cardNumber = "Card number is required"
    } else if (!/^\d{16}$/.test(cardDetails.cardNumber.replace(/\s/g, ""))) {
      newErrors.cardNumber = "Invalid card number"
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
    } else if (!/^\d{3,4}$/.test(cardDetails.cvv)) {
      newErrors.cvv = "Invalid CVV"
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

  const handleCardDetailsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setCardDetails((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  return (
    <>
      <CardHeader>
        <CardTitle className="text-xl">Sign up for a Starter plan</CardTitle>
        <CardDescription>Choose your billing cycle and payment method to complete your registration.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <Label>Select your billing cycle</Label>
              <RadioGroup
                value={formData.planType}
                onValueChange={(value) => updateFormData({ planType: value })}
                className="mt-2 space-y-3"
              >
                <div className="flex items-center space-x-2 border rounded-md p-3 hover:bg-gray-50">
                  <RadioGroupItem value="monthly" id="monthly" />
                  <Label htmlFor="monthly" className="flex-1 cursor-pointer">
                    <div className="font-medium">Monthly Plan</div>
                    <div className="text-sm text-gray-500">${prices.monthly.base} billed monthly</div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-md p-3 hover:bg-gray-50">
                  <RadioGroupItem value="annual" id="annual" />
                  <Label htmlFor="annual" className="flex-1 cursor-pointer">
                    <div className="font-medium">Annual Plan</div>
                    <div className="text-sm text-gray-500">
                      ${prices.annual.base / 12}/mo billed annually (Save ${prices.annual.savings})
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="bg-gray-50 p-4 rounded-md">
              <div className="flex justify-between mb-2">
                <span>STARTER till May 20, 2024</span>
                <span>${prices[formData.planType as keyof typeof prices].total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between mb-2 text-sm">
                <span>SALES TAX {(taxRate * 100).toFixed(2)}%</span>
                <span>${taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-2 mt-2">
                <span>TOTAL</span>
                <span>${totalAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-4">
              <Label>Payment method</Label>
              <div className="space-y-3">
                <div
                  className={`border rounded-md p-4 cursor-pointer ${
                    paymentMethod === "card" ? "border-primary bg-primary/5" : ""
                  }`}
                  onClick={() => setPaymentMethod("card")}
                >
                  <div className="flex items-center">
                    <CreditCard className="h-5 w-5 mr-2" />
                    <span className="font-medium">Pay with a credit or debit card</span>
                  </div>
                  {paymentMethod === "card" && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <Label htmlFor="cardNumber">Card Number</Label>
                        <Input
                          id="cardNumber"
                          name="cardNumber"
                          placeholder="1234 5678 9012 3456"
                          value={cardDetails.cardNumber}
                          onChange={handleCardDetailsChange}
                          className={errors.cardNumber ? "border-red-500" : ""}
                        />
                        {errors.cardNumber && <p className="text-red-500 text-sm mt-1">{errors.cardNumber}</p>}
                      </div>
                      <div>
                        <Label htmlFor="cardName">Name on Card</Label>
                        <Input
                          id="cardName"
                          name="cardName"
                          placeholder="John Doe"
                          value={cardDetails.cardName}
                          onChange={handleCardDetailsChange}
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
                            <SelectTrigger id="expiryMonth" className={errors.expiryMonth ? "border-red-500" : ""}>
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
                            <SelectTrigger id="expiryYear" className={errors.expiryYear ? "border-red-500" : ""}>
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
                          <Label htmlFor="cvv">CVV/CVC</Label>
                          <Input
                            id="cvv"
                            name="cvv"
                            placeholder="123"
                            value={cardDetails.cvv}
                            onChange={handleCardDetailsChange}
                            className={errors.cvv ? "border-red-500" : ""}
                          />
                          {errors.cvv && <p className="text-red-500 text-sm mt-1">{errors.cvv}</p>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="text-sm text-gray-500">The next annual recurring charge will be made on May 20, 2024.</div>
          </div>

          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button type="submit" className="bg-primary">
              Proceed to Purchase
            </Button>
          </div>
        </form>
      </CardContent>
    </>
  )
}
