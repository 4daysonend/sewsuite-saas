"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LoadingSpinner } from "@/components/loading-spinner"
import { Alert } from "@/components/ui/alert"
import { FileText, Upload, Edit3, Shield, Users, CheckCircle, AlertTriangle, Info } from "lucide-react"

export default function LegalSettingsPage() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeEditor, setActiveEditor] = useState<string | null>(null)

  // Legal documents state
  const [legalDocuments, setLegalDocuments] = useState({
    termsAndConditions: {
      content: "",
      isActive: false,
      lastUpdated: null,
    },
    privacyPolicy: {
      content: "",
      isActive: false,
      lastUpdated: null,
    },
    shippingPaymentInfo: {
      content: "",
      isActive: false,
      lastUpdated: null,
    },
    returnPolicy: {
      content: "",
      isActive: false,
      lastUpdated: null,
    },
    aboutUs: {
      content: "",
      isActive: false,
      lastUpdated: null,
    },
  })

  // Consent settings state
  const [consentSettings, setConsentSettings] = useState({
    requireTermsConsent: true,
    requestMarketingConsent: false,
    cookieConsentBanner: true,
    ageConfirmationPopup: false,
    gdprCompliance: true,
  })

  // Custom contracts state
  const [customContracts, setCustomContracts] = useState([
    {
      id: "1",
      name: "Sewing Service Agreement",
      type: "service",
      content: "",
      isActive: true,
      createdAt: "2024-01-15",
    },
  ])

  const handleDocumentUpdate = (docType: string, content: string) => {
    setLegalDocuments((prev) => ({
      ...prev,
      [docType]: {
        ...prev[docType as keyof typeof prev],
        content,
        lastUpdated: new Date().toISOString(),
      },
    }))
  }

  const handleConsentToggle = (setting: string, value: boolean) => {
    setConsentSettings((prev) => ({
      ...prev,
      [setting]: value,
    }))
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, docType: string) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Simulate file upload and text extraction
    setIsSubmitting(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Mock extracted content
      const mockContent = `# ${file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]/g, " ")
        .toUpperCase()}

This is the content extracted from the uploaded file: ${file.name}

## Terms and Conditions

[Content would be extracted from the uploaded document]

## Agreement Details

[Additional terms and conditions would appear here]

---
*Document uploaded on ${new Date().toLocaleDateString()}*`

      handleDocumentUpdate(docType, mockContent)
    } catch (error) {
      console.error("File upload failed:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveDocument = async (docType: string) => {
    setIsSubmitting(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      setActiveEditor(null)
      // Handle success
    } catch (error) {
      console.error("Failed to save document:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const legalDocumentTypes = [
    {
      key: "termsAndConditions",
      title: "Terms & Conditions",
      description:
        "Describe the legally binding rules, terms, and guidelines that everyone has to agree with in order to use your website and services.",
      icon: FileText,
    },
    {
      key: "privacyPolicy",
      title: "Privacy Policy",
      description: "Describe how you collect, handle, and process data of your customers and visitors.",
      icon: Shield,
    },
    {
      key: "shippingPaymentInfo",
      title: "Shipping & Payment Info",
      description: "Describe how you ship or deliver your products and accept payments for the orders.",
      icon: FileText,
    },
    {
      key: "returnPolicy",
      title: "Return Policy",
      description:
        "Describe how you make the returns, exchanges, or refunds if customers are not satisfied with their orders.",
      icon: FileText,
    },
    {
      key: "aboutUs",
      title: "About Us",
      description: "Provide customers with more insight into your business and products.",
      icon: Info,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Legal Settings</h1>
        <p className="text-muted-foreground mt-1">Manage legal documents, policies, and compliance settings</p>
      </div>

      <Tabs defaultValue="compliance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="compliance">Legal Compliance</TabsTrigger>
          <TabsTrigger value="documents">Legal Documents</TabsTrigger>
          <TabsTrigger value="contracts">Custom Contracts</TabsTrigger>
          <TabsTrigger value="consent">Consent Settings</TabsTrigger>
        </TabsList>

        {/* Legal Compliance Tab */}
        <TabsContent value="compliance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Accordance with law</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                These settings cover major legal areas that you must consider when running an online business in your
                country.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="border-blue-200 bg-blue-50">
                <Info className="h-4 w-4 text-blue-600" />
                <div className="text-blue-800">
                  <h4 className="font-medium mb-2">Legal compliance</h4>
                  <p className="text-sm">
                    When running an online business, you are obliged to comply with laws and requirements concerning
                    taxes, shipping and payment, customer consent and privacy. The tools on this page will help your
                    business maintain legal compliance, but it is your responsibility to fully comply with all
                    applicable regulations.
                  </p>
                </div>
              </Alert>

              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Add terms of use and privacy policy</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Add documents that state the rules and conditions on which you supply your service and describe your
                    shipping, payment, and return policies.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Comply with customer consent requirements</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Ask customers for their consent for processing marketing emails or any other use of their personal
                    data if that's required by applicable laws and obtain consent with terms of use.
                  </p>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Comply with privacy and personal data regulations</h4>
                  <p className="text-sm text-muted-foreground">
                    Inform customers that you collect, use, and store their personal information. If any of your
                    visitors are European Union residents, you must comply with the General Data Protection Regulation
                    (GDPR). This law governs the way businesses process and manage personal data. According to GDPR, you
                    must tell visitors clearly what you're going to do with their data, provide and delete all their
                    data at their request.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Legal Documents Tab */}
        <TabsContent value="documents" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Legal pages and policies</CardTitle>
              <p className="text-sm text-muted-foreground">
                Your legal documents are displayed in your website footer. Add the necessary legal pages to comply with
                relevant rules and regulations.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {legalDocumentTypes.map((docType) => (
                <div key={docType.key} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <docType.icon className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium">{docType.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{docType.description}</p>
                        {legalDocuments[docType.key as keyof typeof legalDocuments].lastUpdated && (
                          <p className="text-xs text-green-600 mt-2 flex items-center">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Last updated:{" "}
                            {new Date(
                              legalDocuments[docType.key as keyof typeof legalDocuments].lastUpdated!,
                            ).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveEditor(activeEditor === docType.key ? null : docType.key)}
                      >
                        <Edit3 className="h-4 w-4 mr-1" />
                        {activeEditor === docType.key ? "Cancel" : "Edit"}
                      </Button>
                      <div className="relative">
                        <input
                          type="file"
                          accept=".txt,.doc,.docx,.pdf"
                          onChange={(e) => handleFileUpload(e, docType.key)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          disabled={isSubmitting}
                        />
                        <Button variant="outline" size="sm" disabled={isSubmitting}>
                          <Upload className="h-4 w-4 mr-1" />
                          Upload
                        </Button>
                      </div>
                    </div>
                  </div>

                  {activeEditor === docType.key && (
                    <div className="space-y-4 border-t pt-4">
                      <div>
                        <Label htmlFor={`${docType.key}-content`}>Document Content</Label>
                        <Textarea
                          id={`${docType.key}-content`}
                          value={legalDocuments[docType.key as keyof typeof legalDocuments].content}
                          onChange={(e) => handleDocumentUpdate(docType.key, e.target.value)}
                          placeholder={`Enter your ${docType.title.toLowerCase()} content here...`}
                          className="min-h-[300px] mt-2"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          You can use Markdown formatting for better document structure.
                        </p>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setActiveEditor(null)}>
                          Cancel
                        </Button>
                        <Button onClick={() => handleSaveDocument(docType.key)} disabled={isSubmitting}>
                          {isSubmitting ? <LoadingSpinner size="small" /> : "Save Document"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom Contracts Tab */}
        <TabsContent value="contracts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Custom Contracts & Agreements</CardTitle>
              <p className="text-sm text-muted-foreground">
                Create and manage custom contracts for your sewing services, alterations, and special projects.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Your Contracts</h3>
                <Button>
                  <FileText className="h-4 w-4 mr-2" />
                  Create New Contract
                </Button>
              </div>

              {customContracts.map((contract) => (
                <div key={contract.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="font-medium">{contract.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        Type: {contract.type} • Created: {new Date(contract.createdAt).toLocaleDateString()}
                      </p>
                      <div className="flex items-center mt-2">
                        <div
                          className={`h-2 w-2 rounded-full mr-2 ${contract.isActive ? "bg-green-500" : "bg-gray-400"}`}
                        />
                        <span className="text-xs text-muted-foreground">
                          {contract.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <Edit3 className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <div className="relative">
                        <input
                          type="file"
                          accept=".txt,.doc,.docx,.pdf"
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Button variant="outline" size="sm">
                          <Upload className="h-4 w-4 mr-1" />
                          Replace
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <Alert className="border-yellow-200 bg-yellow-50">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <div className="text-yellow-800">
                  <h4 className="font-medium mb-1">Legal Disclaimer</h4>
                  <p className="text-sm">
                    These contract templates are for reference only. Please consult with a legal professional to ensure
                    your contracts comply with local laws and adequately protect your business interests.
                  </p>
                </div>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Consent Settings Tab */}
        <TabsContent value="consent" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Customers' consent</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                When running an online business, it's crucial that you provide your customers with information on how
                you handle their personal data, conditions under which you provide services, and the services you offer
                or order fulfillment. Settings below request customers' consent explicitly and help provide them with
                the required information.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Require consent to terms and conditions at checkout</h4>
                    <p className="text-sm text-muted-foreground">
                      Display an "I agree with the terms and conditions" checkbox that links to your legal documents on
                      the cart page. Customers need to confirm that they accept your terms by checking the checkbox
                      before they can continue with their order.
                    </p>
                  </div>
                  <Switch
                    checked={consentSettings.requireTermsConsent}
                    onCheckedChange={(checked) => handleConsentToggle("requireTermsConsent", checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Request customers' approval for your marketing emails at checkout</h4>
                    <p className="text-sm text-muted-foreground">
                      Display a checkbox that invites customers to subscribe to promotional emails from you. Customers
                      who check the checkbox and opt in are automatically flagged as willing to accept marketing emails.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                      Edit
                    </Button>
                    <Switch
                      checked={consentSettings.requestMarketingConsent}
                      onCheckedChange={(checked) => handleConsentToggle("requestMarketingConsent", checked)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Cookie consent banner</h4>
                    <p className="text-sm text-muted-foreground">
                      Add a dialog box to your site which explicitly asks if your visitors are okay with their activity
                      being tracked. Visitors which opt out of being tracked will result in analytics gathered by Google
                      Analytics and Meta Pixel, but their personal data is not collected.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                      Manage Banner
                    </Button>
                    <Switch
                      checked={consentSettings.cookieConsentBanner}
                      onCheckedChange={(checked) => handleConsentToggle("cookieConsentBanner", checked)}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">Age confirmation pop-up</h4>
                    <p className="text-sm text-muted-foreground">
                      Add an age confirmation pop-up to your store to stay legally compliant and control access to
                      age-restricted products like alcohol, tobacco, and vapes. The pop-up appears when customers enter
                      your store and restricts access if they don't confirm their legal age. You can customize the
                      pop-up content to meet your needs.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                      Upgrade to Add Pop-Up
                    </Button>
                    <Switch
                      checked={consentSettings.ageConfirmationPopup}
                      onCheckedChange={(checked) => handleConsentToggle("ageConfirmationPopup", checked)}
                      disabled
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Tools for managing customers' personal data</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">Customers' personal data</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  According to GDPR, any customer whose data you store must be able to find out what data you've
                  collected about them and be able to request that data to be deleted. Options below let you retrieve
                  customers' personal data and submit a request for data removal. When a customer requests you to delete
                  their personal data, you must delete the process of data removal.
                </p>
                <div className="space-y-2">
                  <Button variant="outline" size="sm">
                    Get customer data
                  </Button>
                  <Button variant="outline" size="sm">
                    Delete customer data
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
