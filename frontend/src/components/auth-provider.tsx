"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

type User = {
  id: string
  email: string
  firstName?: string
  lastName?: string
  fullName?: string
  emailVerified: boolean
  role: "user" | "admin"
}

type AuthContextType = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: { email: string; password: string; firstName?: string; lastName?: string }) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Simulate fetching user data
    const checkAuth = async () => {
      try {
        // In a real app, you would fetch the user from an API or session
        // This is just a mock implementation
        const storedUser = localStorage.getItem("sewsuite-user")

        if (storedUser) {
          setUser(JSON.parse(storedUser))
        }

        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (error) {
        console.error("Authentication error:", error)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = async (email: string, password: string) => {
    setLoading(true)
    try {
      // Mock login - replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Mock user data
      const userData: User = {
        id: "user-1",
        email,
        firstName: "John",
        lastName: "Doe",
        fullName: "John Doe",
        emailVerified: true,
        role: email.includes("admin") ? "admin" : "user",
      }

      setUser(userData)
      localStorage.setItem("sewsuite-user", JSON.stringify(userData))
      router.push("/dashboard")
    } catch (error) {
      console.error("Login error:", error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const register = async (data: { email: string; password: string; firstName?: string; lastName?: string }) => {
    setLoading(true)
    try {
      // Mock registration - replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Mock user data
      const userData: User = {
        id: "user-" + Math.floor(Math.random() * 1000),
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        fullName: data.firstName && data.lastName ? `${data.firstName} ${data.lastName}` : undefined,
        emailVerified: false,
        role: "user",
      }

      setUser(userData)
      localStorage.setItem("sewsuite-user", JSON.stringify(userData))
      router.push("/dashboard")
    } catch (error) {
      console.error("Registration error:", error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("sewsuite-user")
    router.push("/login")
  }

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
