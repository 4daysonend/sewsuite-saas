"use client"

import { useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { CalendarView } from "@/components/calendar/calendar-view"
import { AppointmentModal } from "@/components/calendar/appointment-modal"
import { CalendarSidebar } from "@/components/calendar/calendar-sidebar"
import { CalendarHeader } from "@/components/calendar/calendar-header"
import { OrderCalendarHeader } from "@/components/calendar/order-calendar-header"
import { OrderFormModal } from "@/components/calendar/order-form-modal"
import { LoadingSpinner } from "@/components/loading-spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { CalendarEvent, CalendarView as ViewType } from "@/types/calendar"

export default function CalendarPage() {
  const { user, loading } = useAuth()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<ViewType>("month")
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [activeTab, setActiveTab] = useState<"appointments" | "orders">("appointments")
  const [isOrderFormOpen, setIsOrderFormOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<any>(null)

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  if (!user) return null

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    setSelectedEvent(null)
    if (activeTab === "appointments") {
      setIsModalOpen(true)
    } else {
      setIsOrderFormOpen(true)
    }
  }

  const handleEventSelect = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setIsModalOpen(true)
  }

  const handleOrderSelect = (order: any) => {
    setSelectedOrder(order)
    setIsOrderFormOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedEvent(null)
    setSelectedDate(null)
  }

  const handleCloseOrderForm = () => {
    setIsOrderFormOpen(false)
    setSelectedOrder(null)
    setSelectedDate(null)
  }

  const handleNewOrder = () => {
    setSelectedOrder(null)
    setIsOrderFormOpen(true)
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "appointments" | "orders")}
        className="w-full"
      >
        <TabsList className="grid w-[400px] grid-cols-2 mx-auto">
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="appointments" className="flex flex-col flex-1">
          <CalendarHeader currentDate={currentDate} view={view} onDateChange={setCurrentDate} onViewChange={setView} />
          <div className="flex flex-1 overflow-hidden">
            <CalendarSidebar />
            <div className="flex-1 p-6">
              <CalendarView
                currentDate={currentDate}
                view={view}
                onDateSelect={handleDateSelect}
                onEventSelect={handleEventSelect}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="flex flex-col flex-1">
          <OrderCalendarHeader onNewOrder={handleNewOrder} />
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 p-6">
              <CalendarView
                currentDate={currentDate}
                view={view}
                onDateSelect={handleDateSelect}
                onEventSelect={handleOrderSelect}
                isOrderCalendar
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <AppointmentModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        event={selectedEvent}
        selectedDate={selectedDate}
      />

      <OrderFormModal
        isOpen={isOrderFormOpen}
        onClose={handleCloseOrderForm}
        order={selectedOrder}
        selectedDate={selectedDate}
      />
    </div>
  )
}
