"use client"

import { useState, useEffect } from "react"
import { MonthView } from "./month-view"
import { WeekView } from "./week-view"
import { DayView } from "./day-view"
import type { CalendarEvent, CalendarView as ViewType } from "@/types/calendar"

// Mock data for calendar events
const mockEvents: CalendarEvent[] = [
  {
    id: "1",
    title: "Client Consultation",
    description: "Initial consultation for wedding dress",
    start: (() => {
      const date = new Date()
      date.setHours(10, 0, 0, 0)
      return date
    })(),
    end: (() => {
      const date = new Date()
      date.setHours(11, 0, 0, 0)
      return date
    })(),
    type: "consultation",
    status: "confirmed",
    customer: {
      name: "Jane Smith",
      email: "jane@example.com",
      phone: "555-123-4567",
    },
  },
  {
    id: "2",
    title: "Dress Fitting",
    description: "First fitting for evening gown",
    start: (() => {
      const date = new Date()
      date.setDate(date.getDate() + 2)
      date.setHours(14, 0, 0, 0)
      return date
    })(),
    end: (() => {
      const date = new Date()
      date.setDate(date.getDate() + 2)
      date.setHours(15, 30, 0, 0)
      return date
    })(),
    type: "fitting",
    status: "confirmed",
    customer: {
      name: "Emily Johnson",
      email: "emily@example.com",
      phone: "555-987-6543",
    },
  },
]

// Mock data for orders
const mockOrders = [
  {
    id: "order-1",
    title: "Wedding Dress",
    clientName: "Sarah Parker",
    startDate: (() => {
      const date = new Date()
      date.setDate(date.getDate() - 5)
      return date.toISOString().split("T")[0]
    })(),
    dueDate: (() => {
      const date = new Date()
      date.setDate(date.getDate() + 25)
      return date.toISOString().split("T")[0]
    })(),
    status: "in-progress",
    priority: "High",
    garmentType: "dress",
    totalPrice: "1200",
  },
  {
    id: "order-2",
    title: "Business Suit",
    clientName: "Michael Chen",
    startDate: (() => {
      const date = new Date()
      date.setDate(date.getDate() - 2)
      return date.toISOString().split("T")[0]
    })(),
    dueDate: (() => {
      const date = new Date()
      date.setDate(date.getDate() + 10)
      return date.toISOString().split("T")[0]
    })(),
    status: "pending",
    priority: "Medium",
    garmentType: "suit",
    totalPrice: "850",
  },
  {
    id: "order-3",
    title: "Evening Gown",
    clientName: "Lisa Rodriguez",
    startDate: (() => {
      const date = new Date()
      date.setDate(date.getDate() - 15)
      return date.toISOString().split("T")[0]
    })(),
    dueDate: (() => {
      const date = new Date()
      date.setDate(date.getDate() + 2)
      return date.toISOString().split("T")[0]
    })(),
    status: "completed",
    priority: "Medium",
    garmentType: "dress",
    totalPrice: "950",
  },
]

interface CalendarViewProps {
  currentDate: Date
  view: ViewType
  onDateSelect: (date: Date) => void
  onEventSelect: (event: CalendarEvent) => void
  isOrderCalendar?: boolean
}

export function CalendarView({
  currentDate,
  view,
  onDateSelect,
  onEventSelect,
  isOrderCalendar = false,
}: CalendarViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [orders, setOrders] = useState<any[]>([])

  useEffect(() => {
    // In a real app, you would fetch events from an API
    setEvents(mockEvents)
    setOrders(mockOrders)
  }, [])

  // Convert orders to calendar events for display
  const orderEvents: CalendarEvent[] = orders.map((order) => {
    const startDate = new Date(order.startDate)
    const dueDate = new Date(order.dueDate)

    // Determine color based on status
    let color = ""
    switch (order.status) {
      case "in-progress":
        color = "blue"
        break
      case "pending":
        color = "yellow"
        break
      case "completed":
        color = "green"
        break
      default:
        color = "gray"
    }

    return {
      id: order.id,
      title: `${order.title} - ${order.clientName}`,
      description: `${order.garmentType} - $${order.totalPrice}`,
      start: startDate,
      end: dueDate,
      allDay: true,
      color,
      type: "order",
      status: order.status,
      order: order,
    }
  })

  const displayEvents = isOrderCalendar ? orderEvents : events

  const renderView = () => {
    switch (view) {
      case "month":
        return (
          <MonthView
            currentDate={currentDate}
            events={displayEvents}
            onDateSelect={onDateSelect}
            onEventSelect={onEventSelect}
          />
        )
      case "week":
        return (
          <WeekView
            currentDate={currentDate}
            events={displayEvents}
            onDateSelect={onDateSelect}
            onEventSelect={onEventSelect}
          />
        )
      case "day":
        return (
          <DayView
            currentDate={currentDate}
            events={displayEvents}
            onDateSelect={onDateSelect}
            onEventSelect={onEventSelect}
          />
        )
      default:
        return null
    }
  }

  return <div className="h-full">{renderView()}</div>
}
