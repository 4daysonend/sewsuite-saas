"use client"

import type { CalendarEvent } from "@/types/calendar"

interface DayViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onDateSelect: (date: Date) => void
  onEventSelect: (event: CalendarEvent) => void
}

export function DayView({ currentDate, events, onDateSelect, onEventSelect }: DayViewProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const today = new Date()
  const isToday = currentDate.toDateString() === today.toDateString()

  const getEventsForHour = (hour: number) => {
    return events.filter((event) => {
      const eventDate = new Date(event.start)
      return eventDate.toDateString() === currentDate.toDateString() && eventDate.getHours() === hour
    })
  }

  const formatHour = (hour: number) => {
    if (hour === 0) return "12:00 AM"
    if (hour === 12) return "12:00 PM"
    if (hour < 12) return `${hour}:00 AM`
    return `${hour - 12}:00 PM`
  }

  const getCurrentTimePosition = () => {
    if (!isToday) return null
    const now = new Date()
    const hours = now.getHours()
    const minutes = now.getMinutes()
    return ((hours * 60 + minutes) / 60) * 80 // 80px per hour
  }

  const currentTimePosition = getCurrentTimePosition()

  return (
    <div className="bg-white rounded-lg border">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="text-center">
          <div className="text-xs text-gray-500 uppercase">
            {currentDate.toLocaleDateString("en-US", { weekday: "long" })}
          </div>
          <div className={`text-2xl font-medium ${isToday ? "text-blue-600" : "text-gray-900"}`}>
            {currentDate.getDate()}
          </div>
          <div className="text-sm text-gray-500">
            {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </div>
        </div>
      </div>

      {/* Time slots */}
      <div className="max-h-[600px] overflow-y-auto relative">
        {/* Current time indicator */}
        {currentTimePosition !== null && (
          <div
            className="absolute left-0 right-0 z-10 border-t-2 border-red-500"
            style={{ top: `${currentTimePosition + 60}px` }}
          >
            <div className="absolute -left-2 -top-2 w-4 h-4 bg-red-500 rounded-full"></div>
          </div>
        )}

        {hours.map((hour) => {
          const hourEvents = getEventsForHour(hour)
          return (
            <div key={hour} className="flex border-b last:border-b-0">
              <div className="w-20 p-2 border-r text-xs text-gray-500 text-right">{formatHour(hour)}</div>
              <div
                className="flex-1 min-h-[80px] p-2 cursor-pointer hover:bg-gray-50 relative"
                onClick={() => {
                  const selectedDateTime = new Date(currentDate)
                  selectedDateTime.setHours(hour, 0, 0, 0)
                  onDateSelect(selectedDateTime)
                }}
              >
                {hourEvents.map((event, index) => (
                  <div
                    key={event.id}
                    className={`p-2 rounded mb-2 cursor-pointer hover:shadow-sm transition-shadow ${event.color} text-white`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEventSelect(event)
                    }}
                  >
                    <div className="font-medium">{event.title}</div>
                    {event.customer && <div className="text-sm opacity-90">{event.customer.name}</div>}
                    <div className="text-xs opacity-75">
                      {new Date(event.start).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      -{" "}
                      {new Date(event.end).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
