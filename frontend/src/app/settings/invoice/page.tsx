"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { LoadingSpinner } from "@/components/loading-spinner"
import { Badge } from "@/components/ui/badge"
import { Upload, FileText, Eye, Download, Crown } from "lucide-react"

export default function InvoiceSettingsPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>("")

  const [invoiceSettings, setInvoiceSettings] = useState({
    // Logo settings
    companyLogo: "",
    logoPosition: "left",

    // Content settings
    taxId: "",
    taxIdLabel: "Tax registration ID",
    businessDetails: "Additional information or contact details",

    // Footer settings
    footerMessage: "Notice for customers or Thank you message",

    // Template settings
    templateStyle: "standard",
    colorScheme: "blue",

    // File naming
    customFileName: "Invoice",
    includeOrderNumber: true,
    includeDateInName: true,

    // Advanced settings
    showBarcode: true,
    currencySymbol: "$",
    dateFormat: "MM/DD/YYYY",
    numberFormat: "INV-{number}",
  })

  const handleInputChange = (field: string, value: string | boolean) => {
    setInvoiceSettings((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLogoFile(file)

    // Create preview URL
    const reader = new FileReader()
    reader.onload = (e) => {
      setLogoPreview(e.target?.result as string)
      handleInputChange("companyLogo", e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveSettings = async () => {
    setIsSubmitting(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      // Handle success
    } catch (error) {
      console.error("Failed to save invoice settings:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Mock invoice data for preview
  const mockInvoiceData = {
    invoiceNumber: "INV-001",
    date: "May 23, 2024 10:18 PM",
    dueDate: "June 22, 2024",
    billTo: {
      name: "John Doe",
      company: "Client Company Co",
      address: "123 Main Street\nAnytown, Missouri 64001\nUnited States",
      email: "john.doe@example.com",
    },
    shipTo: {
      address: "Same as billing address",
    },
    items: [
      {
        description: "Custom Wedding Dress",
        quantity: 1,
        price: 850.0,
      },
      {
        description: "Alterations",
        quantity: 1,
        price: 75.0,
      },
    ],
    subtotal: 925.0,
    shipping: 25.0,
    tax: 74.0,
    total: 1024.0,
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Settings Panel */}
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Customize Invoice</h1>
          <div className="flex space-x-4 mt-2 text-sm">
            <span className="text-primary border-b-2 border-primary pb-1">Preview</span>
            <span className="text-muted-foreground">Print preview</span>
          </div>
        </div>

        {/* Logo Section */}
        <Card>
          <CardHeader>
            <CardTitle>Logo</CardTitle>
            <p className="text-sm text-muted-foreground">Add or change the company's logo on your invoice.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              {logoPreview ? (
                <div className="space-y-2">
                  <img src={logoPreview || "/placeholder.svg"} alt="Company Logo" className="max-h-20 mx-auto" />
                  <p className="text-sm text-muted-foreground">Logo uploaded successfully</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 mx-auto text-gray-400" />
                  <p className="text-sm text-muted-foreground">Upload invoice logo</p>
                </div>
              )}
            </div>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <Button variant="outline" className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                Upload Logo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Recommended size: 250×100 px</p>
          </CardContent>
        </Card>

        {/* Content Section */}
        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="taxId">Tax ID</Label>
              <Input
                id="taxId"
                value={invoiceSettings.taxId}
                onChange={(e) => handleInputChange("taxId", e.target.value)}
                placeholder="Tax ID number"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxIdLabel">Tax ID name: Tax registration ID</Label>
              <div className="flex items-center space-x-2">
                <Input
                  id="taxIdLabel"
                  value={invoiceSettings.taxIdLabel}
                  onChange={(e) => handleInputChange("taxIdLabel", e.target.value)}
                  placeholder="Tax registration ID"
                />
                <Button variant="outline" size="sm">
                  Edit name
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the company registration number of your business, or any business ID that you want to be displayed
                for the invoice so that it's required by law in your country.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessDetails">Business details</Label>
              <Textarea
                id="businessDetails"
                value={invoiceSettings.businessDetails}
                onChange={(e) => handleInputChange("businessDetails", e.target.value)}
                placeholder="Additional information or contact details"
                className="min-h-[100px]"
              />
              <p className="text-xs text-muted-foreground">
                Provide any details about your business that may be required by law or worth mentioning, such as bank
                account details or additional contact information.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer Message */}
        <Card>
          <CardHeader>
            <CardTitle>Footer message</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Textarea
                value={invoiceSettings.footerMessage}
                onChange={(e) => handleInputChange("footerMessage", e.target.value)}
                placeholder="Notice for customers or Thank you message"
                className="min-h-[80px]"
              />
              <p className="text-xs text-muted-foreground">
                Leave notice for customers or thank them for their purchase in the bottom of invoice.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Template */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              To create a branded invoice template, you can edit the invoice template using HTML tags, CSS styles and
              special expressions.
            </p>
            <p className="text-sm text-muted-foreground">
              This feature is available with the <strong>Business</strong> plan and higher.
            </p>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              <Crown className="h-4 w-4 mr-2" />
              Upgrade
            </Button>
          </CardContent>
        </Card>

        {/* Custom Invoice File Name */}
        <Card>
          <CardHeader>
            <CardTitle>Custom invoice file name</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Change your invoice file name for your and your customers' convenience. Add your store name, order number
              and other relevant details.
            </p>
            <div className="space-y-2">
              <Label htmlFor="customFileName">Customize File Name</Label>
              <Input
                id="customFileName"
                value={invoiceSettings.customFileName}
                onChange={(e) => handleInputChange("customFileName", e.target.value)}
                placeholder="Invoice"
              />
            </div>
          </CardContent>
        </Card>

        {/* Advanced Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Advanced Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Show barcode on invoice</Label>
                <p className="text-sm text-muted-foreground">Display a barcode for easy scanning and tracking</p>
              </div>
              <Switch
                checked={invoiceSettings.showBarcode}
                onCheckedChange={(checked) => handleInputChange("showBarcode", checked)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currencySymbol">Currency Symbol</Label>
              <Select
                value={invoiceSettings.currencySymbol}
                onValueChange={(value) => handleInputChange("currencySymbol", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="$">$ (USD)</SelectItem>
                  <SelectItem value="€">€ (EUR)</SelectItem>
                  <SelectItem value="£">£ (GBP)</SelectItem>
                  <SelectItem value="¥">¥ (JPY)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dateFormat">Date Format</Label>
              <Select
                value={invoiceSettings.dateFormat}
                onValueChange={(value) => handleInputChange("dateFormat", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="numberFormat">Invoice Number Format</Label>
              <Input
                id="numberFormat"
                value={invoiceSettings.numberFormat}
                onChange={(e) => handleInputChange("numberFormat", e.target.value)}
                placeholder="INV-{number}"
              />
              <p className="text-xs text-muted-foreground">
                Use {"{number}"} as placeholder for auto-incrementing number
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-2">
          <Button variant="outline">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button onClick={handleSaveSettings} disabled={isSubmitting}>
            {isSubmitting ? <LoadingSpinner size="small" /> : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Invoice Preview Panel */}
      <div className="lg:sticky lg:top-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Invoice Preview</CardTitle>
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              INVOICE PREVIEW
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="bg-white border rounded-lg p-6 space-y-6 text-sm">
              {/* Header */}
              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  {logoPreview ? (
                    <img src={logoPreview || "/placeholder.svg"} alt="Company Logo" className="max-h-12" />
                  ) : (
                    <div className="w-24 h-12 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-500">
                      Your Logo
                    </div>
                  )}
                  <div className="text-xs text-gray-600">
                    <div>SewSuite Company (demo)</div>
                    <div>123 Main St</div>
                    <div>Miami, FL 33101</div>
                    <div>United States</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">Customer Invoice</div>
                  <div className="text-xs text-gray-600">invoice@sewsuite.com</div>
                </div>
              </div>

              {/* Invoice Details */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="font-medium">Invoice Date:</div>
                    <div className="text-gray-600">{mockInvoiceData.date}</div>
                  </div>
                  <div>
                    <div className="font-medium">Due Date:</div>
                    <div className="text-gray-600">{mockInvoiceData.dueDate}</div>
                  </div>
                </div>
              </div>

              {/* Bill To / Ship To */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="font-medium mb-1">Bill to:</div>
                  <div className="text-gray-600 whitespace-pre-line">
                    {mockInvoiceData.billTo.name}
                    {"\n"}
                    {mockInvoiceData.billTo.company}
                    {"\n"}
                    {mockInvoiceData.billTo.address}
                    {"\n"}
                    {mockInvoiceData.billTo.email}
                  </div>
                </div>
                <div>
                  <div className="font-medium mb-1">Ship to:</div>
                  <div className="text-gray-600">{mockInvoiceData.shipTo.address}</div>
                </div>
              </div>

              {/* Tax ID */}
              {invoiceSettings.taxId && (
                <div className="text-xs">
                  <span className="font-medium">{invoiceSettings.taxIdLabel}:</span>
                  <span className="text-gray-600 ml-1">{invoiceSettings.taxId}</span>
                </div>
              )}

              {/* Order Information */}
              <div className="border-t pt-4">
                <div className="font-medium text-xs mb-2">Order Information</div>
                <div className="text-xs text-gray-600">Leave on front porch</div>
              </div>

              {/* Line Items */}
              <div className="border-t pt-4">
                <div className="font-medium text-xs mb-2">Order #1</div>
                <div className="space-y-2">
                  {mockInvoiceData.items.map((item, index) => (
                    <div key={index} className="flex justify-between text-xs">
                      <div className="flex-1">
                        <div>{item.description}</div>
                        <div className="text-gray-500">Qty: {item.quantity}</div>
                      </div>
                      <div className="text-right">
                        {invoiceSettings.currencySymbol}
                        {item.price.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t pt-4 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>
                    {invoiceSettings.currencySymbol}
                    {mockInvoiceData.subtotal.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>
                    {invoiceSettings.currencySymbol}
                    {mockInvoiceData.shipping.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>
                    {invoiceSettings.currencySymbol}
                    {mockInvoiceData.tax.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between font-bold border-t pt-1">
                  <span>Total</span>
                  <span>
                    {invoiceSettings.currencySymbol}
                    {mockInvoiceData.total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Footer Message */}
              {invoiceSettings.footerMessage && (
                <div className="border-t pt-4 text-xs text-gray-600">{invoiceSettings.footerMessage}</div>
              )}

              {/* Business Details */}
              {invoiceSettings.businessDetails && (
                <div className="text-xs text-gray-600">{invoiceSettings.businessDetails}</div>
              )}

              {/* Barcode */}
              {invoiceSettings.showBarcode && (
                <div className="flex justify-center pt-4">
                  <div className="text-center">
                    <div className="text-xs text-gray-500 mb-1">Please save this page</div>
                    <div className="font-mono text-lg tracking-wider">||||| |||| ||||| ||||</div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-center space-x-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
