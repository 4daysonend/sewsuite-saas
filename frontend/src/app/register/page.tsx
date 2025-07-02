"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { UserSignupForm } from "@/components/registration/user-signup-form"
import { StoreSetupForm } from "@/components/registration/store-setup-form"
import { CompanyAddressForm } from "@/components/registration/company-address-form"
import { PaymentConfirmationForm } from "@/components/registration/payment-confirmation-form"
import { CheckCircle } from "lucide-react"

export default function RegisterPage() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    // User data
    firstName: "",
    lastName: "",
    email: "",
    password: "",

    // Store data
    storeName: "",
    country: "United States",
    currency: "U.S. dollar",

    // Address data
    address: "",
    city: "New York",
    zipCode: "",

    // Payment data
    planType: "monthly", // monthly or annual
  })
  const router = useRouter()
  const totalSteps = 4

  const updateFormData = (data: Partial<typeof formData>) => {
    setFormData((prev) => ({ ...prev, ...data }))
  }

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1)
      window.scrollTo(0, 0)
    } else {
      // Submit the form and redirect
      router.push("/dashboard")
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
      window.scrollTo(0, 0)
    }
  }

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return <UserSignupForm formData={formData} updateFormData={updateFormData} onNext={handleNext} />
      case 2:
        return (
          <StoreSetupForm formData={formData} updateFormData={updateFormData} onNext={handleNext} onBack={handleBack} />
        )
      case 3:
        return (
          <CompanyAddressForm
            formData={formData}
            updateFormData={updateFormData}
            onNext={handleNext}
            onBack={handleBack}
          />
        )
      case 4:
        return (
          <PaymentConfirmationForm
            formData={formData}
            updateFormData={updateFormData}
            onNext={handleNext}
            onBack={handleBack}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="py-4 px-6 bg-white border-b">
        <div className="max-w-7xl mx-auto flex items-center">
          <Link href="/" className="flex items-center">
            <div className="relative h-8 w-8 mr-2">
              <div className="absolute inset-0 bg-primary rounded-md flex items-center justify-center text-white text-xs font-bold">
                SS
              </div>
            </div>
            <span className="text-lg font-semibold">SewSuite</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row max-w-7xl mx-auto w-full p-4 gap-8">
        <div className="w-full md:w-64 shrink-0">
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="font-medium mb-2">
              Complete your registration Step {step} of {totalSteps}
            </div>
            <div className="text-sm text-gray-500 mb-4">Give us some details to help you launch a store.</div>
            <div className={`flex items-center text-sm ${step >= 1 ? "text-blue-600" : "text-gray-500"}`}>
              {step > 1 ? (
                <CheckCircle className="h-4 w-4 mr-1" />
              ) : (
                <div className={`h-4 w-4 rounded-full ${step === 1 ? "bg-blue-600" : "border border-gray-300"} mr-1`} />
              )}
              <span>Step 1: Create account</span>
            </div>
            <div className={`flex items-center text-sm mt-2 ${step >= 2 ? "text-blue-600" : "text-gray-500"}`}>
              {step > 2 ? (
                <CheckCircle className="h-4 w-4 mr-1" />
              ) : (
                <div className={`h-4 w-4 rounded-full ${step === 2 ? "bg-blue-600" : "border border-gray-300"} mr-1`} />
              )}
              <span>Step 2: Store setup</span>
            </div>
            <div className={`flex items-center text-sm mt-2 ${step >= 3 ? "text-blue-600" : "text-gray-500"}`}>
              {step > 3 ? (
                <CheckCircle className="h-4 w-4 mr-1" />
              ) : (
                <div className={`h-4 w-4 rounded-full ${step === 3 ? "bg-blue-600" : "border border-gray-300"} mr-1`} />
              )}
              <span>Step 3: Company address</span>
            </div>
            <div className={`flex items-center text-sm mt-2 ${step >= 4 ? "text-blue-600" : "text-gray-500"}`}>
              {step > 4 ? (
                <CheckCircle className="h-4 w-4 mr-1" />
              ) : (
                <div className={`h-4 w-4 rounded-full ${step === 4 ? "bg-blue-600" : "border border-gray-300"} mr-1`} />
              )}
              <span>Step 4: Confirmation</span>
            </div>
          </div>
        </div>

        <div className="flex-1">
          <Card className="w-full">{renderStepContent()}</Card>
        </div>
      </main>

      <footer className="py-4 px-6 border-t text-center text-sm text-gray-500">
        <div className="max-w-7xl mx-auto">
          <p>© 2020-2023 SewSuite.com</p>
          <div className="flex justify-center space-x-4 mt-2">
            <Link href="/" className="hover:underline">
              SewSuite Home
            </Link>
            <Link href="/blog" className="hover:underline">
              Blog
            </Link>
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>
            <Link href="/policy" className="hover:underline">
              Policy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
