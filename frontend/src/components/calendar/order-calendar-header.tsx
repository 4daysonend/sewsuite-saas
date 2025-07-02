"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Calendar, List, QrCode, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface OrderCalendarHeaderProps {
  onNewOrder: () => void
}

export function OrderCalendarHeader({ onNewOrder }: OrderCalendarHeaderProps) {
  // Mock data - in a real app, this would come from your data store
  const orderCounts = {
    total: 3,
    inProgress: 1,
    pending: 1,
    completed: 1,
  }

  return (
    <div className="p-4 border-b">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">Order Calendar</h1>
          <p className="text-muted-foreground">Manage orders, track progress, and schedule fittings</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <QrCode className="h-4 w-4 mr-2" />
            Scan QR
          </Button>
          <Button onClick={onNewOrder}>
            <Plus className="h-4 w-4 mr-2" />
            New Order
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-4">
        <Card className="p-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Total Orders</div>
            <div className="text-2xl font-bold">{orderCounts.total}</div>
          </div>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Calendar className="h-5 w-5" />
          </Button>
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">In Progress</div>
            <div className="text-2xl font-bold">{orderCounts.inProgress}</div>
          </div>
          <Badge className="bg-blue-500 h-3 w-3 rounded-full p-0" />
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Pending</div>
            <div className="text-2xl font-bold">{orderCounts.pending}</div>
          </div>
          <Badge className="bg-yellow-500 h-3 w-3 rounded-full p-0" />
        </Card>

        <Card className="p-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Completed</div>
            <div className="text-2xl font-bold">{orderCounts.completed}</div>
          </div>
          <Badge className="bg-green-500 h-3 w-3 rounded-full p-0" />
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="relative">
            <select className="appearance-none bg-background border rounded-md px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-primary">
              <option>All Status</option>
              <option>In Progress</option>
              <option>Pending</option>
              <option>Completed</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="relative">
            <select className="appearance-none bg-background border rounded-md px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-primary">
              <option>All Priority</option>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          <div className="relative">
            <select className="appearance-none bg-background border rounded-md px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-primary">
              <option>All Dates</option>
              <option>This Week</option>
              <option>This Month</option>
              <option>Next Month</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="rounded-md">
            <Calendar className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="rounded-md">
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
