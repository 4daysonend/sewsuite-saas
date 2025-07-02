"use client"

import { useRouter } from "next/navigation"

export default function CustomerGroupsPage() {
  const router = useRouter()

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Customer Groups Settings</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Feature Card 1 */}
        <div className="bg-white shadow-md rounded-md p-4">
          <h2 className="text-lg font-semibold mb-2">Customer Groups</h2>
          <p className="text-gray-600">
            Segment your customers based on various criteria to personalize their experience.
          </p>
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4"
            onClick={() => router.push("/checkout?plan=professional&feature=customer-groups")}
          >
            Upgrade to Unlock
          </button>
        </div>

        {/* Feature Card 2 */}
        <div className="bg-white shadow-md rounded-md p-4">
          <h2 className="text-lg font-semibold mb-2">Auto Segmentation</h2>
          <p className="text-gray-600">Automatically group customers based on their behavior and purchase history.</p>
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4"
            onClick={() => router.push("/checkout?plan=business&feature=auto-segmentation")}
          >
            Upgrade to Unlock
          </button>
        </div>

        {/* Feature Card 3 */}
        <div className="bg-white shadow-md rounded-md p-4">
          <h2 className="text-lg font-semibold mb-2">Group Analytics</h2>
          <p className="text-gray-600">Analyze the performance of each customer group to optimize your strategies.</p>
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4"
            onClick={() => router.push("/checkout?plan=business&feature=group-analytics")}
          >
            Upgrade to Unlock
          </button>
        </div>

        {/* Feature Card 4 */}
        <div className="bg-white shadow-md rounded-md p-4">
          <h2 className="text-lg font-semibold mb-2">Targeted Campaigns</h2>
          <p className="text-gray-600">Create and launch targeted campaigns for specific customer groups.</p>
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4"
            onClick={() => router.push("/checkout?plan=marketing&feature=targeted-campaigns")}
          >
            Upgrade to Unlock
          </button>
        </div>

        {/* Feature Card 5 */}
        <div className="bg-white shadow-md rounded-md p-4">
          <h2 className="text-lg font-semibold mb-2">Lifecycle Management</h2>
          <p className="text-gray-600">Manage the customer lifecycle by automating actions based on their stage.</p>
          <button
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-4"
            onClick={() => router.push("/checkout?plan=marketing&feature=lifecycle-management")}
          >
            Upgrade to Unlock
          </button>
        </div>
      </div>
    </div>
  )
}
