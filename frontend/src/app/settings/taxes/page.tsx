"use client"

import { useRouter } from "next/navigation"

export default function TaxesPage() {
  const router = useRouter()

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Tax Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Tax Automation Feature */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-lg font-semibold mb-2">Tax Automation</h2>
          <p className="text-gray-700">Automatically calculate and apply taxes to your transactions.</p>
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4"
            onClick={() => router.push("/checkout?plan=business&feature=tax-automation")}
          >
            Upgrade to Enable
          </button>
        </div>

        {/* Advanced Reporting Feature */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-lg font-semibold mb-2">Advanced Reporting</h2>
          <p className="text-gray-700">Gain deeper insights into your tax obligations with detailed reports.</p>
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4"
            onClick={() => router.push("/checkout?plan=professional&feature=tax-reporting")}
          >
            Upgrade to Enable
          </button>
        </div>

        {/* Multi-Location Feature */}
        <div className="bg-white rounded-lg shadow-md p-4">
          <h2 className="text-lg font-semibold mb-2">Multi-Location Support</h2>
          <p className="text-gray-700">Manage taxes for multiple business locations with ease.</p>
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4"
            onClick={() => router.push("/checkout?plan=business&feature=multi-location")}
          >
            Upgrade to Enable
          </button>
        </div>
      </div>
    </div>
  )
}
