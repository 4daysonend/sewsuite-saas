export type CalendarView = "month" | "week" | "day"

export interface Customer {
  name: string
  email: string
  phone: string
}

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  start: Date
  end: Date
  allDay?: boolean
  color?: string
  type: string
  status: string
  customer?: Customer
  order?: any
}

export interface OrderMeasurements {
  bustChest: string
  waist: string
  hips: string
  length: string
  shoulders: string
  inseam: string
}

export interface Order {
  id: string
  clientName: string
  email?: string
  phone?: string
  garmentType: string
  materials?: string
  description?: string
  measurements: OrderMeasurements
  startDate: string
  fittingDate?: string
  dueDate: string
  totalPrice?: string
  deposit?: string
  estimatedHours?: string
  priority: string
  status: string
  notes?: string
}

export interface CalendarSettings {
  workingHours: {
    start: string
    end: string
  }
  workingDays: number[]
  timeZone: string
  defaultAppointmentDuration: number
  bufferTime: number
  allowBookingAdvance: number
  reminderSettings: {
    email: boolean
    sms: boolean
    defaultMinutesBefore: number
  }
}
