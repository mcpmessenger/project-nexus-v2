"use client"

import * as React from "react"
import type { User } from "@/lib/types"

interface AuthContextType {
  user: User | null
  loading: boolean
  error: string | null
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    // Fetch session on mount
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  return <AuthContext.Provider value={{ user, loading, error }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
