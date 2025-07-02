import { LoadingSpinner } from "@/components/loading-spinner"

export default function DashboardLoading() {
  return (
    <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
      <LoadingSpinner size="large" />
    </div>
  )
}
