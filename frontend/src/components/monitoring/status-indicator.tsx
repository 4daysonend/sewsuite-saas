import { Badge } from "@/components/ui/badge"

type StatusType = "healthy" | "degraded" | "unhealthy"

interface StatusIndicatorProps {
  status: StatusType
}

export function StatusIndicator({ status }: StatusIndicatorProps) {
  const variants = {
    healthy: {
      variant: "outline" as const,
      className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
      label: "Healthy",
    },
    degraded: {
      variant: "outline" as const,
      className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
      label: "Degraded",
    },
    unhealthy: {
      variant: "outline" as const,
      className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
      label: "Unhealthy",
    },
  }

  const { variant, className, label } = variants[status] || variants.unhealthy

  return (
    <Badge variant={variant} className={className}>
      <span
        className={`mr-1 inline-block h-2 w-2 rounded-full ${status === "healthy" ? "bg-green-500" : status === "degraded" ? "bg-yellow-500" : "bg-red-500"}`}
      ></span>
      {label}
    </Badge>
  )
}
