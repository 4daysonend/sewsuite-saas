"use client"

import type { CalendarEvent } from "@/types/calendar"

interface WeekViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onDateSelect: (date: Date) => void
  onEventSelect: (event: CalendarEvent) => void
}

export function WeekView({ currentDate, events, onDateSelect, onEventSelect }: WeekViewProps) {
  const today = new Date()
  const startOfWeek = new Date(currentDate)
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay())

  const weekDays = []
  for (let i = 0; i < 7; i++) {
    const day = new Date(startOfWeek)
    day.setDate(startOfWeek.getDate() + i)
    weekDays.push(day)
  }

  const hours = Array.from({ length: 24 }, (_, i) => i)

  const getEventsForDateTime = (date: Date, hour: number) => {
    return events.filter((event) => {
      const eventDate = new Date(event.start)
      return eventDate.toDateString() === date.toDateString() && eventDate.getHours() === hour
    })
  }

  const formatHour = (hour: number) => {
    if (hour === 0) return "12 AM"
    if (hour === 12) return "12 PM"
    if (hour < 12) return `${hour} AM`
    return `${hour - 12} PM`
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      {/* Header with dates */}
      <div className="grid grid-cols-8 border-b">
        <div className="p-4 border-r"></div>
        {weekDays.map((day, index) => {
          const isToday = day.toDateString() === today.toDateString()
          return (
            <div
              key={index}
              className={`p-4 text-center border-r last:border-r-0 cursor-pointer hover:bg-gray-50 ${
                isToday ? "bg-blue-50" : ""
              }`}
              onClick={() => onDateSelect(day)}
            >
              <div className="text-xs text-gray-500 uppercase">
                {day.toLocaleDateString("en-US", { weekday: "short" })}
              </div>
              <div className={`text-lg font-medium ${isToday ? "text-blue-600" : "text-gray-900"}`}>
                {day.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div className="max-h-[600px] overflow-y-auto">
        {hours.map((hour) => (
          <div key={hour} className="grid grid-cols-8 border-b last:border-b-0">
            <div className="p-2 border-r text-xs text-gray-500 text-right">{formatHour(hour)}</div>
            {weekDays.map((day, dayIndex) => {
              const dayEvents = getEventsForDateTime(day, hour)
              return (
                <div
                  key={dayIndex}
                  className="min-h-[60px] p-1 border-r last:border-r-0 cursor-pointer hover:bg-gray-50"
                  onClick={() => {
                    const selectedDateTime = new Date(day)
                    selectedDateTime.setHours(hour, 0, 0, 0)
                    onDateSelect(selectedDateTime)
                  }}
                >
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className={`text-xs p-1 rounded mb-1 cursor-pointer hover:shadow-sm transition-shadow ${event.color} text-white`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventSelect(event)
                      }}
                    >
                      <div className="font-medium truncate">{event.title}</div>
                      {event.customer && <div className="truncate opacity-90">{event.customer.name}</div>}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
