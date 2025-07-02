import { type User, UserRole, type QueryUsersParams } from "@/components/user/user-management-dashboard"

// Mock data for demonstration
const mockUsers: User[] = Array.from({ length: 50 }, (_, i) => ({
  id: `user-${i + 1}`,
  email: `user${i + 1}@example.com`,
  firstName: `First${i + 1}`,
  lastName: `Last${i + 1}`,
  fullName: `First${i + 1} Last${i + 1}`,
  role: i % 10 === 0 ? UserRole.ADMIN : i % 3 === 0 ? UserRole.TAILOR : UserRole.CLIENT,
  displayRole: i % 10 === 0 ? "Administrator" : i % 3 === 0 ? "Tailor" : "Client",
  isActive: i % 7 !== 0, // Some inactive users
  emailVerified: i % 5 !== 0, // Some unverified users
  createdAt: new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString(),
}))

export async function queryUsers(params: QueryUsersParams) {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 800))

  let filteredUsers = [...mockUsers]

  // Apply filters
  if (params.searchTerm) {
    const searchLower = params.searchTerm.toLowerCase()
    filteredUsers = filteredUsers.filter(
      (user) =>
        user.email.toLowerCase().includes(searchLower) ||
        user.firstName?.toLowerCase().includes(searchLower) ||
        user.lastName?.toLowerCase().includes(searchLower) ||
        user.fullName?.toLowerCase().includes(searchLower),
    )
  }

  if (params.role) {
    filteredUsers = filteredUsers.filter((user) => user.role === params.role)
  }

  if (params.isActive !== undefined) {
    filteredUsers = filteredUsers.filter((user) => user.isActive === params.isActive)
  }

  if (params.isVerified !== undefined) {
    filteredUsers = filteredUsers.filter((user) => user.emailVerified === params.isVerified)
  }

  // Apply sorting
  if (params.sortBy) {
    filteredUsers.sort((a: any, b: any) => {
      const aValue = a[params.sortBy!]
      const bValue = b[params.sortBy!]

      if (typeof aValue === "string" && typeof bValue === "string") {
        return params.sortOrder === "ASC" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
      }

      return params.sortOrder === "ASC" ? aValue - bValue : bValue - aValue
    })
  }

  // Get total before pagination
  const total = filteredUsers.length

  // Apply pagination
  const page = params.page || 1
  const limit = params.limit || 10
  const start = (page - 1) * limit
  const end = start + limit

  filteredUsers = filteredUsers.slice(start, end)

  return {
    users: filteredUsers,
    total,
  }
}
