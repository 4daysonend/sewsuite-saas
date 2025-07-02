"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { useAuth } from "@/components/auth-provider"
import { LoadingSpinner } from "@/components/loading-spinner"
import { Search, FolderPlus, Upload, Filter, Grid, List, MoreVertical, FileText, Folder, ImageIcon } from "lucide-react"

export default function FilesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [storageUsed, setStorageUsed] = useState(2.5)
  const [storageLimit, setStorageLimit] = useState(10)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [loading, user, router])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  if (!user) return null

  // Mock file data
  const files = [
    {
      id: "1",
      name: "Summer Dress Pattern.pdf",
      type: "pdf",
      size: "2.5 MB",
      date: "Jan 14, 2024",
      icon: FileText,
    },
    {
      id: "2",
      name: "Client Measurements.docx",
      type: "docx",
      size: "1.2 MB",
      date: "Jan 9, 2024",
      icon: FileText,
    },
    {
      id: "3",
      name: "Fabric Samples",
      type: "folder",
      items: 12,
      date: "Jan 7, 2024",
      icon: Folder,
    },
    {
      id: "4",
      name: "Design Inspiration.jpg",
      type: "jpg",
      size: "3.8 MB",
      date: "Jan 3, 2024",
      icon: ImageIcon,
    },
    {
      id: "5",
      name: "Invoice Template.docx",
      type: "docx",
      size: "0.2 MB",
      date: "Jan 2, 2024",
      icon: FileText,
    },
  ]

  const getFileIcon = (file: any) => {
    const IconComponent = file.icon
    return <IconComponent className="h-6 w-6" />
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Files</h1>
          <p className="text-muted-foreground">Manage your patterns, documents, and images</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <FolderPlus className="h-4 w-4 mr-2" />
            New Folder
          </Button>
          <Button>
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </Button>
        </div>
      </div>

      <Card className="p-4 mb-6">
        <div className="flex justify-between items-center">
          <div className="text-sm">Storage Usage</div>
          <div className="text-sm">
            {storageUsed} GB of {storageLimit} GB used
          </div>
        </div>
        <Progress value={(storageUsed / storageLimit) * 100} className="h-2 mt-2" />
      </Card>

      <div className="flex justify-between items-center mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search files..." className="pl-10" />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              All Files
            </Button>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setViewMode("grid")}
            className={viewMode === "grid" ? "bg-muted" : ""}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setViewMode("list")}
            className={viewMode === "list" ? "bg-muted" : ""}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-medium">All Files</h2>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>

        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {files.map((file) => (
              <div
                key={file.id}
                className="border rounded-lg p-4 flex flex-col items-center cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <div className="mb-2 text-muted-foreground">{getFileIcon(file)}</div>
                <div className="text-sm font-medium text-center truncate w-full">{file.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {file.type === "folder" ? `${file.items} items` : file.size}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{file.date}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border rounded-lg divide-y">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="text-muted-foreground">{getFileIcon(file)}</div>
                  <div>
                    <div className="font-medium">{file.name}</div>
                    <div className="text-xs text-muted-foreground">{file.date}</div>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  {file.type === "folder" ? `${file.items} items` : file.size}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
