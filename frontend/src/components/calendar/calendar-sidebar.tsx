"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Calendar, Clock, Users, Search, Plus, Eye, EyeOff, MoreHorizontal } from "lucide-react"

export function CalendarSidebar() {
  const [searchTerm, setSearchTerm] = useState("")
  const [visibleCalendars, setVisibleCalendars] = useState({
    appointments: true,
    orders: true,
    personal: true,
    holidays: false,
  })

  const upcomingAppointments = [
    {
      id: 1,
      title: "Wedding Dress Fitting",
      customer: "Sarah Johnson",
      time: "10:00 AM",
      date: "Today",
      type: "fitting",
    },
    {
      id: 2,
      title: "Consultation - Prom Dress",
      customer: "Emily Davis",
      time: "2:00 PM",
      date: "Today",
      type: "consultation",
    },
    {
      id: 3,
      title: "Alteration Pickup",
      customer: "Michael Brown",
      time: "11:00 AM",
      date: "Tomorrow",
      type: "pickup",
    },
    {
      id: 4,
      title: "Suit Measurements",
      customer: "David Wilson",
      time: "3:30 PM",
      date: "Tomorrow",
      type: "measurement",
    },
  ]

  const calendars = [
    { id: "appointments", name: "Appointments", color: "bg-blue-500", count: 12 },
    { id: "orders", name: "Order Deadlines", color: "bg-red-500", count: 8 },
    { id: "personal", name: "Personal", color: "bg-green-500", count: 3 },
    { id: "holidays", name: "Holidays", color: "bg-purple-500", count: 5 },
  ]

  const toggleCalendar = (calendarId: string) => {
    setVisibleCalendars((prev) => ({
      ...prev,
      [calendarId]: !prev[calendarId as keyof typeof prev],
    }))
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "fitting":
        return "bg-blue-100 text-blue-800"
      case "consultation":
        return "bg-green-100 text-green-800"
      case "pickup":
        return "bg-orange-100 text-orange-800"
      case "measurement":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="w-80 border-r bg-gray-50 p-4 space-y-6">
      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button className="w-full justify-start" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Appointment
          </Button>
          <Button variant="outline" className="w-full justify-start" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            Block Time
          </Button>
          <Button variant="outline" className="w-full justify-start" size="sm">
            <Users className="h-4 w-4 mr-2" />
            Group Booking
          </Button>
        </CardContent>
      </Card>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search appointments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* My Calendars */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">My Calendars</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {calendars.map((calendar) => (
            <div key={calendar.id} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Checkbox
                  checked={visibleCalendars[calendar.id as keyof typeof visibleCalendars]}
                  onCheckedChange={() => toggleCalendar(calendar.id)}
                />
                <div className={`w-3 h-3 rounded-full ${calendar.color}`} />
                <span className="text-sm font-medium">{calendar.name}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Badge variant="secondary" className="text-xs">
                  {calendar.count}
                </Badge>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  {visibleCalendars[calendar.id as keyof typeof visibleCalendars] ? (
                    <Eye className="h-3 w-3" />
                  ) : (
                    <EyeOff className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Upcoming Appointments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {upcomingAppointments.map((appointment) => (
            <div
              key={appointment.id}
              className="p-3 bg-white rounded-lg border hover:shadow-sm transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{appointment.title}</p>
                  <p className="text-xs text-gray-500 mt-1">{appointment.customer}</p>
                  <div className="flex items-center mt-2 space-x-2">
                    <div className="flex items-center text-xs text-gray-500">
                      <Clock className="h-3 w-3 mr-1" />
                      {appointment.time}
                    </div>
                    <Badge className={`text-xs ${getTypeColor(appointment.type)}`}>{appointment.type}</Badge>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
