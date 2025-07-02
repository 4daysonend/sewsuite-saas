"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface OrderFormModalProps {
  isOpen: boolean
  onClose: () => void
  order?: any | null
  selectedDate?: Date | null
}

export function OrderFormModal({ isOpen, onClose, order, selectedDate }: OrderFormModalProps) {
  const [activeTab, setActiveTab] = useState("client")
  const [formData, setFormData] = useState({
    // Client Information
    clientName: "",
    email: "",
    phone: "",

    // Garment Information
    garmentType: "",
    materials: "",
    description: "",

    // Measurements
    measurements: {
      bustChest: "",
      waist: "",
      hips: "",
      length: "",
      shoulders: "",
      inseam: "",
    },

    // Schedule & Pricing
    startDate: "",
    fittingDate: "",
    dueDate: "",
    totalPrice: "",
    deposit: "",
    estimatedHours: "",
    priority: "Medium",

    // Notes
    notes: "",
  })

  // Generate a unique order ID for QR code
  const [orderId] = useState(() => `ORDER-${Math.floor(Math.random() * 10000)}`)

  useEffect(() => {
    if (order) {
      // Populate form with order data, ensuring measurements object exists
      setFormData({
        ...formData,
        ...order,
        measurements: {
          bustChest: "",
          waist: "",
          hips: "",
          length: "",
          shoulders: "",
          inseam: "",
          ...(order.measurements || {}),
        },
      })
    } else if (selectedDate) {
      // Set default dates based on selected date
      const dateStr = selectedDate.toISOString().split("T")[0]

      // Set start date to selected date
      // Set fitting date to 7 days after
      const fittingDate = new Date(selectedDate)
      fittingDate.setDate(fittingDate.getDate() + 7)

      // Set due date to 14 days after
      const dueDate = new Date(selectedDate)
      dueDate.setDate(dueDate.getDate() + 14)

      setFormData({
        ...formData,
        startDate: dateStr,
        fittingDate: fittingDate.toISOString().split("T")[0],
        dueDate: dueDate.toISOString().split("T")[0],
      })
    }
  }, [order, selectedDate])

  const handleSave = () => {
    // Here you would save the order
    console.log("Saving order:", formData)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{order ? "Edit Order" : "New Order"}</h2>
          <div className="flex items-center gap-2">
            {order && (
              <div className="flex flex-col items-center">
                <QRCodeSVG value={orderId} size={80} />
                <span className="text-xs text-muted-foreground mt-1">{orderId}</span>
              </div>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="client">Client Information</TabsTrigger>
            <TabsTrigger value="garment">Garment Information</TabsTrigger>
            <TabsTrigger value="measurements">Measurements</TabsTrigger>
            <TabsTrigger value="schedule">Schedule & Pricing</TabsTrigger>
          </TabsList>

          <TabsContent value="client" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="clientName">Client Name *</Label>
                <Input
                  id="clientName"
                  value={formData.clientName}
                  onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                  placeholder="Enter client name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="client@example.com"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="garment" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="garmentType">Garment Type *</Label>
                <Select
                  value={formData.garmentType}
                  onValueChange={(value) => setFormData({ ...formData, garmentType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select garment type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dress">Dress</SelectItem>
                    <SelectItem value="shirt">Shirt</SelectItem>
                    <SelectItem value="pants">Pants</SelectItem>
                    <SelectItem value="skirt">Skirt</SelectItem>
                    <SelectItem value="jacket">Jacket</SelectItem>
                    <SelectItem value="coat">Coat</SelectItem>
                    <SelectItem value="suit">Suit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="materials">Materials</Label>
                <Input
                  id="materials"
                  value={formData.materials}
                  onChange={(e) => setFormData({ ...formData, materials: e.target.value })}
                  placeholder="Silk, Lace, Cotton (comma separated)"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed description of this garment..."
                  rows={4}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="measurements" className="space-y-4 mt-4">
            <h3 className="font-medium">Measurements (inches)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="bustChest">Bust/Chest</Label>
                <Input
                  id="bustChest"
                  value={formData.measurements?.bustChest || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      measurements: {
                        ...formData.measurements,
                        bustChest: e.target.value,
                      },
                    })
                  }
                />
              </div>

              <div>
                <Label htmlFor="waist">Waist</Label>
                <Input
                  id="waist"
                  value={formData.measurements?.waist || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      measurements: {
                        ...formData.measurements,
                        waist: e.target.value,
                      },
                    })
                  }
                />
              </div>

              <div>
                <Label htmlFor="hips">Hips</Label>
                <Input
                  id="hips"
                  value={formData.measurements?.hips || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      measurements: {
                        ...formData.measurements,
                        hips: e.target.value,
                      },
                    })
                  }
                />
              </div>

              <div>
                <Label htmlFor="length">Length</Label>
                <Input
                  id="length"
                  value={formData.measurements?.length || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      measurements: {
                        ...formData.measurements,
                        length: e.target.value,
                      },
                    })
                  }
                />
              </div>

              <div>
                <Label htmlFor="shoulders">Shoulders</Label>
                <Input
                  id="shoulders"
                  value={formData.measurements?.shoulders || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      measurements: {
                        ...formData.measurements,
                        shoulders: e.target.value,
                      },
                    })
                  }
                />
              </div>

              <div>
                <Label htmlFor="inseam">Inseam</Label>
                <Input
                  id="inseam"
                  value={formData.measurements?.inseam || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      measurements: {
                        ...formData.measurements,
                        inseam: e.target.value,
                      },
                    })
                  }
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date *</Label>
                <div className="relative">
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                  <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div>
                <Label htmlFor="fittingDate">Fitting Date</Label>
                <div className="relative">
                  <Input
                    id="fittingDate"
                    type="date"
                    value={formData.fittingDate}
                    onChange={(e) => setFormData({ ...formData, fittingDate: e.target.value })}
                  />
                  <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              <div>
                <Label htmlFor="dueDate">Due Date *</Label>
                <div className="relative">
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  />
                  <Calendar className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="totalPrice">Total Price ($)</Label>
                <Input
                  id="totalPrice"
                  type="number"
                  value={formData.totalPrice}
                  onChange={(e) => setFormData({ ...formData, totalPrice: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="deposit">Deposit ($)</Label>
                <Input
                  id="deposit"
                  type="number"
                  value={formData.deposit}
                  onChange={(e) => setFormData({ ...formData, deposit: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="estimatedHours">Estimated Hours</Label>
                <Input
                  id="estimatedHours"
                  type="number"
                  value={formData.estimatedHours}
                  onChange={(e) => setFormData({ ...formData, estimatedHours: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData({ ...formData, priority: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes, special requirements, etc..."
                rows={3}
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Order</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
