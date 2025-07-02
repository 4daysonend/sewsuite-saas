"use client"
import type { CalendarEvent } from "@/types/calendar"

interface MonthViewProps {
  currentDate: Date
  events: CalendarEvent[]
  onDateSelect: (date: Date) => void
  onEventSelect: (event: CalendarEvent) => void
}

export function MonthView({ currentDate, events, onDateSelect, onEventSelect }: MonthViewProps) {
  const today = new Date()
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
  const firstDayOfWeek = firstDayOfMonth.getDay()
  const daysInMonth = lastDayOfMonth.getDate()

  const days = []
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfWeek; i++) {
    const prevMonthDay = new Date(firstDayOfMonth)
    prevMonthDay.setDate(prevMonthDay.getDate() - (firstDayOfWeek - i))
    days.push({
      date: prevMonthDay,
      isCurrentMonth: false,
      isToday: false,
    })
  }

  // Add days of the current month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
    const isToday = date.toDateString() === today.toDateString()
    days.push({
      date,
      isCurrentMonth: true,
      isToday,
    })
  }

  // Add days from next month to fill the grid
  const remainingCells = 42 - days.length
  for (let day = 1; day <= remainingCells; day++) {
    const nextMonthDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, day)
    days.push({
      date: nextMonthDay,
      isCurrentMonth: false,
      isToday: false,
    })
  }

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => {
      const eventDate = new Date(event.start)
      return eventDate.toDateString() === date.toDateString()
    })
  }

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case "appointment":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "consultation":
        return "bg-green-100 text-green-800 border-green-200"
      case "deadline":
        return "bg-red-100 text-red-800 border-red-200"
      case "pickup":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "measurement":
        return "bg-purple-100 text-purple-800 border-purple-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  return (
    <div className="bg-white rounded-lg border">
      {/* Header with weekdays */}
      <div className="grid grid-cols-7 border-b">
        {weekdays.map((day) => (
          <div key={day} className="p-4 text-center font-medium text-gray-500 border-r last:border-r-0">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dayEvents = getEventsForDate(day.date)

          return (
            <div
              key={index}
              className={`min-h-[120px] p-2 border-r border-b last:border-r-0 cursor-pointer hover:bg-gray-50 transition-colors ${
                !day.isCurrentMonth ? "bg-gray-50 text-gray-400" : ""
              } ${day.isToday ? "bg-blue-50" : ""}`}
              onClick={() => onDateSelect(day.date)}
            >
              <div
                className={`text-sm font-medium mb-1 ${
                  day.isToday ? "text-blue-600" : day.isCurrentMonth ? "text-gray-900" : "text-gray-400"
                }`}
              >
                {day.date.getDate()}
              </div>

              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    className={`text-xs p-1 rounded border cursor-pointer hover:shadow-sm transition-shadow ${getEventTypeColor(event.type)}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEventSelect(event)
                    }}
                  >
                    <div className="font-medium truncate">{event.title}</div>
                    {event.customer && <div className="truncate opacity-75">{event.customer.name}</div>}
                  </div>
                ))}

                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500 font-medium">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
