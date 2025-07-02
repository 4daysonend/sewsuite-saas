"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, Crown, ArrowRight, Download, Mail } from "lucide-react"

export default function CheckoutSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const plan = searchParams.get("plan") || "professional"
  const billing = searchParams.get("billing") || "monthly"

  const planNames = {
    starter: "Starter",
    sewist: "Sewist",
    studio: "Studio",
    atelier: "Atelier",
  }

  useEffect(() => {
    // Track successful purchase
    console.log(`Purchase completed: ${plan} plan, ${billing} billing`)
  }, [plan, billing])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <Card className="text-center">
          <CardHeader className="pb-4">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-800">Payment Successful!</CardTitle>
            <p className="text-muted-foreground">
              Welcome to SewSuite {planNames[plan as keyof typeof planNames]} plan
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="bg-blue-50 p-6 rounded-lg">
              <div className="flex items-center justify-center mb-4">
                <Crown className="h-6 w-6 text-yellow-500 mr-2" />
                <h3 className="text-lg font-semibold">Your Plan is Now Active</h3>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span>Plan:</span>
                  <Badge variant="secondary">{planNames[plan as keyof typeof planNames]}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Billing:</span>
                  <span className="capitalize">{billing}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Status:</span>
                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold">What's Next?</h4>

              <div className="grid gap-4">
                <div className="flex items-start space-x-3 p-4 border rounded-lg">
                  <Mail className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div className="text-left">
                    <h5 className="font-medium">Check Your Email</h5>
                    <p className="text-sm text-muted-foreground">
                      We've sent you a confirmation email with your receipt and next steps.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-4 border rounded-lg">
                  <Download className="h-5 w-5 text-green-500 mt-0.5" />
                  <div className="text-left">
                    <h5 className="font-medium">Access New Features</h5>
                    <p className="text-sm text-muted-foreground">
                      All premium features are now available in your dashboard.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 p-4 border rounded-lg">
                  <ArrowRight className="h-5 w-5 text-purple-500 mt-0.5" />
                  <div className="text-left">
                    <h5 className="font-medium">Get Started</h5>
                    <p className="text-sm text-muted-foreground">
                      Explore your new capabilities and start growing your business.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Button onClick={() => router.push("/dashboard")} className="flex-1">
                Go to Dashboard
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button variant="outline" onClick={() => router.push("/settings")} className="flex-1">
                Explore Settings
              </Button>
            </div>

            <div className="text-sm text-muted-foreground pt-4 border-t">
              <p>Need help getting started? Contact our support team at support@sewsuite.com</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
