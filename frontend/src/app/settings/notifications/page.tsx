"use client"

import { useRouter } from "next/navigation"

export default function NotificationsSettingsPage() {
  const router = useRouter()

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-semibold mb-5">Notification Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* SMS Notifications */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-3">SMS Notifications</h2>
          <p className="text-gray-600 mb-4">Configure SMS notifications for important events.</p>
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            onClick={() => router.push("/checkout?plan=professional&feature=sms-notifications")}
          >
            Upgrade to Enable
          </button>
        </div>

        {/* Push Notifications */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-3">Push Notifications</h2>
          <p className="text-gray-600 mb-4">Enable push notifications for real-time updates.</p>
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            onClick={() => router.push("/checkout?plan=professional&feature=push-notifications")}
          >
            Upgrade to Enable
          </button>
        </div>

        {/* Email Templates */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-3">Email Templates</h2>
          <p className="text-gray-600 mb-4">Customize email templates for a personalized experience.</p>
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            onClick={() => router.push("/checkout?plan=business&feature=email-templates")}
          >
            Upgrade to Enable
          </button>
        </div>

        {/* Advanced Features */}
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-3">Advanced Features</h2>
          <p className="text-gray-600 mb-4">Unlock advanced notification features for better control.</p>
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            onClick={() => router.push("/checkout?plan=marketing&feature=advanced-notifications")}
          >
            Upgrade to Enable
          </button>
        </div>
      </div>
    </div>
  )
}
