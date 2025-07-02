"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { LoadingSpinner } from "@/components/loading-spinner"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"
import { queryUsers } from "@/services/user-service"

// Types
export enum UserRole {
  ADMIN = "admin",
  TAILOR = "tailor",
  CLIENT = "client",
}

export interface User {
  id: string
  email: string
  firstName?: string
  lastName?: string
  fullName?: string
  role: UserRole
  displayRole?: string
  isActive: boolean
  emailVerified: boolean
  createdAt: string
}

export interface QueryUsersParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: "ASC" | "DESC"
  searchTerm?: string
  role?: UserRole
  isActive?: boolean
  isVerified?: boolean
}

export function UserManagementDashboard() {
  const [users, setUsers] = useState<User[]>([])
  const [totalUsers, setTotalUsers] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Pagination
  const [page, setPage] = useState<number>(1)
  const [limit, setLimit] = useState<number>(10)

  // Filters
  const [filters, setFilters] = useState<QueryUsersParams>({
    page: 1,
    limit: 10,
    sortBy: "createdAt",
    sortOrder: "DESC",
  })

  useEffect(() => {
    fetchUsers()
  }, [page, limit, filters])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)

      const queryParams: QueryUsersParams = {
        ...filters,
        page,
        limit,
      }

      // In a real app, this would be an API call
      const { users: fetchedUsers, total } = await queryUsers(queryParams)

      setUsers(fetchedUsers)
      setTotalUsers(total)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (name: string, value: any) => {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }))
    setPage(1) // Reset to first page when filters change
  }

  const handleRoleFilter = (role: UserRole | "") => {
    setFilters((prev) => ({
      ...prev,
      role: role || undefined,
    }))
    setPage(1)
  }

  const handleSearch = (searchTerm: string) => {
    setFilters((prev) => ({
      ...prev,
      searchTerm: searchTerm || undefined,
    }))
    setPage(1)
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit)
    setPage(1) // Reset to first page when limit changes
  }

  const renderPagination = () => {
    const totalPages = Math.ceil(totalUsers / limit)

    return (
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-muted-foreground">
          Showing <span className="font-medium">{(page - 1) * limit + 1}</span> to{" "}
          <span className="font-medium">{Math.min(page * limit, totalUsers)}</span> of{" "}
          <span className="font-medium">{totalUsers}</span> users
        </div>

        <div className="flex space-x-2">
          <Button variant="outline" size="icon" onClick={() => handlePageChange(page - 1)} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            // Show pages around current page
            const pageToShow = page > 3 ? page - 3 + i + (page + 2 > totalPages ? totalPages - (page + 2) : 0) : i + 1

            if (pageToShow <= totalPages) {
              return (
                <Button
                  key={pageToShow}
                  variant={page === pageToShow ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(pageToShow)}
                >
                  {pageToShow}
                </Button>
              )
            }
            return null
          })}

          <Button
            variant="outline"
            size="icon"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }

  if (loading && users.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  if (error && users.length === 0) {
    return (
      <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md" role="alert">
        <strong className="font-bold">Error!</strong>
        <span className="block sm:inline"> {error}</span>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>Manage your users, view their details, and update their information.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Search and filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          {/* Search */}
          <div className="flex-1 min-w-[250px] relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search users..."
              className="pl-8"
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          {/* Role filter */}
          <div>
            <Select onValueChange={(value) => handleRoleFilter(value as UserRole | "")} defaultValue="">
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value={UserRole.CLIENT}>Client</SelectItem>
                <SelectItem value={UserRole.TAILOR}>Tailor</SelectItem>
                <SelectItem value={UserRole.ADMIN}>Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status filter */}
          <div>
            <Select
              onValueChange={(value) => handleFilterChange("isActive", value === "" ? undefined : value === "true")}
              defaultValue=""
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Verification filter */}
          <div>
            <Select
              onValueChange={(value) => handleFilterChange("isVerified", value === "" ? undefined : value === "true")}
              defaultValue=""
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Verification" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Verification</SelectItem>
                <SelectItem value="true">Verified</SelectItem>
                <SelectItem value="false">Not Verified</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results per page */}
          <div>
            <Select onValueChange={(value) => handleLimitChange(Number(value))} defaultValue="10">
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="10 per page" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 per page</SelectItem>
                <SelectItem value="25">25 per page</SelectItem>
                <SelectItem value="50">50 per page</SelectItem>
                <SelectItem value="100">100 per page</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* User list */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length > 0 ? (
                users.map((user) => (
                  <TableRow key={user.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center">
                        <Avatar className="h-10 w-10 mr-4">
                          <AvatarFallback>
                            {user.firstName?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                            {user.lastName?.[0]?.toUpperCase() || ""}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {user.fullName || `${user.firstName || ""} ${user.lastName || ""}`.trim() || "N/A"}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{user.email}</div>
                      <div className="text-xs">
                        {user.emailVerified ? (
                          <Badge
                            variant="outline"
                            className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                          >
                            Verified
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100"
                          >
                            Not verified
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          user.role === UserRole.ADMIN
                            ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100"
                            : user.role === UserRole.TAILOR
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100"
                              : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                        }
                      >
                        {user.displayRole || user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          user.isActive
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100"
                            : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"
                        }
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild className="mr-2">
                        <Link href={`/admin/users/${user.id}`}>View</Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/users/${user.id}/edit`}>Edit</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {renderPagination()}
      </CardContent>
    </Card>
  )
}
