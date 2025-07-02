"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Calendar, User, Save, Trash2, Edit } from "lucide-react"
import type { CalendarEvent } from "@/types/calendar"

interface AppointmentModalProps {
  isOpen: boolean
  onClose: () => void
  event?: CalendarEvent | null
  selectedDate?: Date | null
}

export function AppointmentModal({ isOpen, onClose, event, selectedDate }: AppointmentModalProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "appointment",
    date: "",
    startTime: "",
    endTime: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    status: "confirmed",
  })

  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title,
        description: event.description || "",
        type: event.type,
        date: new Date(event.start).toISOString().split("T")[0],
        startTime: new Date(event.start).toTimeString().slice(0, 5),
        endTime: new Date(event.end).toTimeString().slice(0, 5),
        customerName: event.customer?.name || "",
        customerEmail: event.customer?.email || "",
        customerPhone: event.customer?.phone || "",
        status: event.status,
      })
      setIsEditing(false)
    } else if (selectedDate) {
      const dateStr = selectedDate.toISOString().split("T")[0]
      const timeStr = selectedDate.toTimeString().slice(0, 5)
      const endTime = new Date(selectedDate.getTime() + 60 * 60 * 1000).toTimeString().slice(0, 5)

      setFormData({
        title: "",
        description: "",
        type: "appointment",
        date: dateStr,
        startTime: timeStr,
        endTime: endTime,
        customerName: "",
        customerEmail: "",
        customerPhone: "",
        status: "confirmed",
      })
      setIsEditing(true)
    }
  }, [event, selectedDate])

  const handleSave = () => {
    // Here you would save the appointment
    console.log("Saving appointment:", formData)
    onClose()
  }

  const handleDelete = () => {
    // Here you would delete the appointment
    console.log("Deleting appointment:", event?.id)
    onClose()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      case "completed":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "appointment":
        return "bg-blue-100 text-blue-800"
      case "consultation":
        return "bg-green-100 text-green-800"
      case "fitting":
        return "bg-purple-100 text-purple-800"
      case "pickup":
        return "bg-orange-100 text-orange-800"
      case "measurement":
        return "bg-indigo-100 text-indigo-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{event ? (isEditing ? "Edit Appointment" : "Appointment Details") : "New Appointment"}</span>
            {event && !isEditing && (
              <div className="flex items-center space-x-2">
                <Badge className={getStatusColor(event.status)}>{event.status}</Badge>
                <Badge className={getTypeColor(event.type)}>{event.type}</Badge>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                disabled={!isEditing && !!event}
                placeholder="Appointment title"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={!isEditing && !!event}
                placeholder="Additional details..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                  disabled={!isEditing && !!event}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="appointment">Appointment</SelectItem>
                    <SelectItem value="consultation">Consultation</SelectItem>
                    <SelectItem value="fitting">Fitting</SelectItem>
                    <SelectItem value="pickup">Pickup</SelectItem>
                    <SelectItem value="measurement">Measurement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                  disabled={!isEditing && !!event}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Separator />

          {/* Date and Time */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              Date & Time
            </h3>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  disabled={!isEditing && !!event}
                />
              </div>

              <div>
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  disabled={!isEditing && !!event}
                />
              </div>

              <div>
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  disabled={!isEditing && !!event}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Customer Information */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center">
              <User className="h-4 w-4 mr-2" />
              Customer Information
            </h3>

            <div className="space-y-4">
              <div>
                <Label htmlFor="customerName">Customer Name</Label>
                <Input
                  id="customerName"
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  disabled={!isEditing && !!event}
                  placeholder="Customer name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customerEmail">Email</Label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                    disabled={!isEditing && !!event}
                    placeholder="customer@example.com"
                  />
                </div>

                <div>
                  <Label htmlFor="customerPhone">Phone</Label>
                  <Input
                    id="customerPhone"
                    type="tel"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    disabled={!isEditing && !!event}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between pt-4">
            <div>
              {event && !isEditing && (
                <Button variant="destructive" onClick={handleDelete} className="flex items-center">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>

            <div className="flex space-x-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>

              {event && !isEditing ? (
                <Button onClick={() => setIsEditing(true)} className="flex items-center">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <Button onClick={handleSave} className="flex items-center">
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
