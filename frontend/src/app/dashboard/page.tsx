"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/components/auth-provider"
import { LoadingSpinner } from "@/components/loading-spinner"
import { ExternalLink, Package, ShoppingCart, Users, DollarSign } from "lucide-react"
import Link from "next/link"

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

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

  // Empty data - no sample data
  const metrics = {
    visitors: { value: 0, change: 0, trend: "neutral" },
    productViews: { value: 0, change: 0, trend: "neutral" },
    ordersReceived: { value: 0, change: 0, trend: "neutral" },
    revenue: { value: 0.0, change: 0, trend: "neutral" },
    visitorsWithProductViews: { value: 0, change: 0, trend: "neutral" },
    addedToCart: { value: 0, change: 0, trend: "neutral" },
    startedCheckout: { value: 0, change: 0, trend: "neutral" },
    placedOrders: { value: 0, change: 0, trend: "neutral" },
  }

  // Empty todo items
  const todoItems: any[] = []

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Greetings!</h1>
          <p className="text-muted-foreground mt-1">Let's take a look at what's happening in your store right now.</p>
          <a
            href="https://sewsuite.com/products"
            className="text-primary hover:underline text-sm inline-flex items-center mt-2"
          >
            https://sewsuite.com/products
            <ExternalLink className="h-3 w-3 ml-1" />
          </a>
        </div>

        {/* To-do List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">To-do list</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todoItems.length > 0 ? (
              todoItems.map((item, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-200">
                    {item.count}
                  </Badge>
                  <div>
                    <span className="font-medium">Orders:</span> {item.message}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No pending tasks at the moment.</p>
            )}
            <p className="text-sm text-muted-foreground">
              Collect payments for Paid, orders, instant payments and ship items to your customers.
            </p>
          </CardContent>
        </Card>

        {/* Promotional Banner */}
        <Card className="bg-gradient-to-r from-green-400 to-green-500 text-white overflow-hidden">
          <CardContent className="p-6 relative">
            <div className="flex items-center justify-between">
              <div className="space-y-2 max-w-md">
                <h3 className="text-xl font-bold">Explore the advantages of higher-tier plans</h3>
                <p className="text-green-50 text-sm">
                  Grow your business with advanced set of features at any scale and level. See the benefits of each plan
                  to find new growth opportunities for your business.
                </p>
                <Button variant="secondary" className="mt-4" asChild>
                  <Link href="/pricing">View Plans and Features</Link>
                </Button>
              </div>
              <div className="hidden md:block">
                <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center">
                  <Package className="h-16 w-16 text-white/80" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reports Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Reports</h2>
          <Button variant="outline" size="sm">
            Last 30 days
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Visitors */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Visitors</p>
                  <p className="text-2xl font-bold">{metrics.visitors.value}</p>
                  <div className="text-xs text-muted-foreground">0% from previous period</div>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          {/* Product Views */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Product views</p>
                  <p className="text-2xl font-bold">{metrics.productViews.value}</p>
                  <p className="text-xs text-muted-foreground">$0.00 total worth of products viewed</p>
                </div>
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          {/* Orders Received */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Orders received</p>
                  <p className="text-2xl font-bold">{metrics.ordersReceived.value}</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          {/* Revenue */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Revenue</p>
                  <p className="text-2xl font-bold">${metrics.revenue.value.toFixed(2)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          {/* Visitors with Product Views */}
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-sm text-muted-foreground">Visitors with product views</p>
                <p className="text-2xl font-bold">{metrics.visitorsWithProductViews.value}</p>
                <p className="text-xs text-muted-foreground">0% total rate of unique products viewed</p>
              </div>
            </CardContent>
          </Card>

          {/* Added to Cart */}
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-sm text-muted-foreground">Added to cart</p>
                <p className="text-2xl font-bold">{metrics.addedToCart.value}</p>
              </div>
            </CardContent>
          </Card>

          {/* Started Checkout */}
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-sm text-muted-foreground">Started checkout</p>
                <p className="text-2xl font-bold">{metrics.startedCheckout.value}</p>
              </div>
            </CardContent>
          </Card>

          {/* Placed Orders */}
          <Card>
            <CardContent className="p-4">
              <div>
                <p className="text-sm text-muted-foreground">Placed orders</p>
                <p className="text-2xl font-bold">{metrics.placedOrders.value}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Abandoned Carts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Abandoned carts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Revenue recovery forecast</p>
                <p className="text-2xl font-bold">-</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Automatic recovery emails</p>
                <p className="text-lg font-semibold text-muted-foreground">Disabled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Blog and Recommended Reading */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Blog and recommended reading</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="w-16 h-16 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="h-8 w-8 text-yellow-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Why Customer Testimonials Are Your Ecommerce Superpower</h3>
                  <p className="text-xs text-muted-foreground">
                    Learn how customer testimonials can boost your sales and build trust with potential customers.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start space-x-4">
                <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Package className="h-8 w-8 text-blue-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Boost Your Sales With SewSuite's Social Selling Tools</h3>
                  <p className="text-xs text-muted-foreground">
                    Discover how to leverage social media to increase your sewing business revenue.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
