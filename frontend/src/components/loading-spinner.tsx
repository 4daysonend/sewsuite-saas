export function LoadingSpinner({ size = "default" }: { size?: "small" | "default" | "large" }) {
  const sizeClasses = {
    small: "h-4 w-4 border-2",
    default: "h-8 w-8 border-2",
    large: "h-12 w-12 border-3",
  }

  return (
    <div className="flex justify-center items-center h-full">
      <div className={`animate-spin rounded-full border-t-transparent border-primary ${sizeClasses[size]}`}></div>
    </div>
  )
}
