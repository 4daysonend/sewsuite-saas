"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ProductSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Product</h1>
        <p className="text-muted-foreground mt-1">Configure product display and management settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Product Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Set up product display options, inventory management, and product-related features.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
