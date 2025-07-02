"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/components/auth-provider"
import { LoadingSpinner } from "@/components/loading-spinner"
import { Check, Star } from "lucide-react"

export default function PricingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly")

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
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

  const calculateYearlySavings = (monthlyPrice: number, yearlyPrice: number) => {
    const monthlyCost = monthlyPrice * 12
    const savings = monthlyCost - yearlyPrice
    const percentage = Math.round((savings / monthlyCost) * 100)
    return { savings, percentage }
  }

  const plans = [
    {
      name: "Starter",
      price: 0,
      originalPrice: 0,
      yearlyPrice: 0,
      description: "Perfect for hobbyists and beginners exploring digital pattern management",
      tier: "Free Tier",
      features: [
        "Limited pattern storage (up to 5 patterns)",
        "Basic client management (up to 3 clients)",
        "Simple measurement tracking",
        "Access to community forum",
        "Mobile-responsive dashboard",
        "Email support (response within 48 hours)",
      ],
      buttonText: "Get Started",
      buttonVariant: "outline" as const,
      popular: false,
    },
    {
      name: "Sewist",
      price: 19.99,
      originalPrice: 19.99,
      yearlyPrice: 199.99,
      description: "Perfect for individual sewists managing personal projects",
      tier: "Basic Tier",
      features: [
        "Everything in Free, plus:",
        "Expanded pattern storage (up to 25 patterns)",
        "Enhanced client management (up to 10 clients)",
        "Detailed measurement system",
        "Basic project tracking",
        "Order history and tracking",
        "Basic analytics dashboard",
        "PDF invoice generation",
        "Priority email support (24-hour response)",
      ],
      buttonText: "Get Started",
      buttonVariant: "default" as const,
      popular: true,
    },
    {
      name: "Studio",
      price: 49.99,
      originalPrice: 49.99,
      yearlyPrice: 499.99,
      description: "Perfect for small sewing businesses and professional solo sewists",
      tier: "Professional Tier",
      features: [
        "Everything in Basic, plus:",
        "Advanced pattern management (up to 100 patterns)",
        "Full client management (up to 50 clients)",
        "Complete measurement system with size recommendations",
        "Detailed project tracking with milestones",
        "Inventory management for materials",
        "Payment processing (2.9% + $0.30 per transaction)",
        "Client portal for measurements and approvals",
        "Automated email notifications",
        "Business analytics dashboard",
        "Chat support during business hours",
        "White-labeled client communications",
      ],
      buttonText: "Get Started",
      buttonVariant: "secondary" as const,
      popular: false,
    },
    {
      name: "Atelier",
      price: 99.99,
      originalPrice: 99.99,
      yearlyPrice: 999.99,
      description: "Perfect for growing sewing businesses with teams",
      tier: "Business Tier",
      features: [
        "Everything in Professional, plus:",
        "Unlimited pattern storage",
        "Unlimited client management",
        "Team member accounts (up to 5 users)",
        "Advanced project management with assignments",
        "Comprehensive material inventory with supplier management",
        "Reduced payment processing fees (2.5% + $0.30 per transaction)",
        "Custom measurement templates",
        "Client order portal",
        "Advanced business analytics and reporting",
        "Priority chat and phone support",
        "Custom branding options",
        "API access for custom integrations",
      ],
      buttonText: "Get Started",
      buttonVariant: "default" as const,
      popular: false,
    },
  ]

  const addOns = [
    {
      name: "Storage Boost",
      price: 9.99,
      description: "Additional pattern storage capacity",
      detail: "+$9.99/month per 100 patterns",
    },
    {
      name: "Team Member Expansion",
      price: 19.99,
      description: "Additional users",
      detail: "+$19.99/month per user",
    },
    {
      name: "Training Sessions",
      price: 99,
      description: "Personalized training",
      detail: "+$99 per session",
    },
    {
      name: "Priority Support",
      price: 49.99,
      description: "Dedicated support agent",
      detail: "+$49.99/month",
    },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-foreground">Explore the right plan for you</h1>
        <div className="flex justify-center space-x-4">
          <Button
            variant={billingCycle === "yearly" ? "default" : "outline"}
            size="sm"
            onClick={() => setBillingCycle("yearly")}
          >
            Annually (save ~17%)
          </Button>
          <Button
            variant={billingCycle === "monthly" ? "default" : "outline"}
            size="sm"
            onClick={() => setBillingCycle("monthly")}
          >
            Monthly
          </Button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan, index) => (
          <Card key={plan.name} className={`relative ${plan.popular ? "ring-2 ring-primary" : ""}`}>
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground">
                  <Star className="h-3 w-3 mr-1" />
                  Most Popular
                </Badge>
              </div>
            )}

            <CardHeader className="text-center pb-4">
              <CardTitle className="text-lg font-semibold">{plan.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{plan.description}</p>
              <div className="mt-4">
                <span className="text-3xl font-bold">
                  $
                  {billingCycle === "yearly" && plan.yearlyPrice > 0
                    ? (plan.yearlyPrice / 12).toFixed(2)
                    : plan.price === 0
                      ? "0"
                      : plan.price.toFixed(2)}
                </span>
                <span className="text-muted-foreground">/mo</span>
              </div>
              {plan.price > 0 && (
                <p className="text-xs text-muted-foreground">
                  {billingCycle === "yearly"
                    ? `$${plan.yearlyPrice}/year (save ~17%)`
                    : `$${plan.price}/month paid monthly`}
                </p>
              )}
            </CardHeader>

            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start space-x-2">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              {plan.name !== "Unlimited" && (
                <div className="pt-2">
                  <Button variant="ghost" size="sm" className="text-primary p-0 h-auto">
                    See all{" "}
                    {plan.name === "Starter"
                      ? "plans and features"
                      : plan.name === "Venture"
                        ? "38 features"
                        : "39 features"}
                  </Button>
                </div>
              )}

              <Button
                variant={plan.buttonVariant}
                className="w-full mt-6"
                onClick={() => router.push(`/checkout?plan=${plan.name.toLowerCase()}&billing=${billingCycle}`)}
              >
                {plan.buttonText}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add-On Options */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold text-center">Add-On Options</h2>
        <p className="text-center text-muted-foreground">Enhance your plan with additional features</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {addOns.map((addon, index) => (
            <Card key={addon.name} className="text-center">
              <CardContent className="p-4">
                <h3 className="font-semibold mb-2">{addon.name}</h3>
                <p className="text-sm text-muted-foreground mb-3">{addon.description}</p>
                <div className="text-lg font-bold text-primary mb-2">
                  {addon.name === "Training Sessions" ? `$${addon.price}` : `$${addon.price}/mo`}
                </div>
                <p className="text-xs text-muted-foreground">{addon.detail}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Enterprise Section */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <div>
              <h3 className="text-2xl font-semibold mb-2">Fashion House</h3>
              <p className="text-sm text-muted-foreground mb-2">Enterprise Tier</p>
              <p className="text-muted-foreground mb-4">
                Perfect for large-scale sewing operations and fashion businesses
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <p>• Everything in Business, plus:</p>
                <p>• Custom number of team member accounts</p>
                <p>• Custom onboarding process</p>
                <p>• Dedicated account manager</p>
                <p>• Lowest payment processing fees (negotiable)</p>
                <p>• Enterprise-level security features</p>
              </div>
              <div className="space-y-2">
                <p>• Custom integration development</p>
                <p>• On-site training available</p>
                <p>• SLA with guaranteed uptime</p>
                <p>• Early access to new features</p>
                <p>• Custom feature development options</p>
              </div>
            </div>

            <div className="pt-4">
              <div className="text-2xl font-bold mb-4">Custom Pricing</div>
              <Button
                size="lg"
                className="bg-purple-600 hover:bg-purple-700"
                onClick={() => router.push("/contact-sales?plan=enterprise")}
              >
                Get Started
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Information */}
      <div className="bg-muted/50 rounded-lg p-6 space-y-4">
        <h2 className="text-xl font-semibold">SewSuite Platform Features</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <h3 className="font-medium mb-2">Digital Pattern Management</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Secure cloud storage for all patterns</li>
              <li>• Version control and pattern history</li>
              <li>• Easy sharing and collaboration tools</li>
              <li>• Pattern categorization and tagging</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-2">Client & Project Management</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Comprehensive client profiles</li>
              <li>• Project timelines and milestones</li>
              <li>• Automated client communications</li>
              <li>• Order and fitting tracking</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-2">Measurement System</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Digital measurement records</li>
              <li>• Custom measurement templates</li>
              <li>• Size recommendation engine</li>
              <li>• Measurement history tracking</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-2">Business Operations</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Inventory management for materials</li>
              <li>• Automated invoicing and payments</li>
              <li>• Business analytics and reporting</li>
              <li>• Team collaboration tools</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-2">Client Experience</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Client portal for measurements</li>
              <li>• Order tracking and updates</li>
              <li>• Fitting appointment scheduling</li>
              <li>• Progress photos and approvals</li>
            </ul>
          </div>

          <div>
            <h3 className="font-medium mb-2">Professional Tools</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• White-labeled communications</li>
              <li>• Custom branding options</li>
              <li>• API access for integrations</li>
              <li>• Advanced security features</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground space-y-2">
        <p>© 2020-2023 SewSuite.com</p>
        <div className="flex justify-center space-x-4">
          <Button variant="link" size="sm" className="text-muted-foreground p-0 h-auto">
            SewSuite Home
          </Button>
          <Button variant="link" size="sm" className="text-muted-foreground p-0 h-auto">
            Blog
          </Button>
          <Button variant="link" size="sm" className="text-muted-foreground p-0 h-auto">
            Terms
          </Button>
          <Button variant="link" size="sm" className="text-muted-foreground p-0 h-auto">
            Policy
          </Button>
        </div>
      </div>
    </div>
  )
}
