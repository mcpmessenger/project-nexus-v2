"use client"

import * as React from "react"
import { supabase } from "@/lib/supabase-client"
import type { User } from "@/lib/types"
import type { User as SupabaseUser } from "@supabase/supabase-js"

interface AuthContextType {
  user: User | null
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, name?: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  signInWithOAuth: (provider: "google" | "github") => Promise<void>
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined)

// Convert Supabase user to our User type
function mapSupabaseUser(supabaseUser: SupabaseUser | null): User | null {
  if (!supabaseUser) return null

  return {
    id: supabaseUser.id,
    email: supabaseUser.email || "",
    name: supabaseUser.user_metadata?.full_name || 
          supabaseUser.user_metadata?.name || 
          supabaseUser.email?.split("@")[0] || 
          "User",
    org_id: supabaseUser.user_metadata?.org_id || `org-${supabaseUser.id}`,
    avatar_url: supabaseUser.user_metadata?.avatar_url || supabaseUser.user_metadata?.picture,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Initialize auth state
  React.useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(mapSupabaseUser(session?.user ?? null))
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const newUser = mapSupabaseUser(session?.user ?? null)
      setUser(newUser)
      setLoading(false)
      
      // Migrate localStorage servers to Supabase on first login
      if (event === "SIGNED_IN" && newUser && typeof window !== "undefined") {
        try {
          const storedUserServers = localStorage.getItem("user_servers")
          if (storedUserServers) {
            const userServers = JSON.parse(storedUserServers)
            if (userServers.length > 0) {
              console.log(`[Auth] Migrating ${userServers.length} servers from localStorage to Supabase...`)
              
              // Migrate each server to Supabase
              for (const server of userServers) {
                try {
                  const response = await fetch("/api/servers", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: server.name,
                      url: server.url,
                      transport: server.transport,
                      apiKey: server.apiKey,
                      logoUrl: server.logoUrl,
                      description: server.description,
                    }),
                  })
                  
                  if (response.ok) {
                    console.log(`[Auth] ✅ Migrated server: ${server.name}`)
                  } else {
                    console.error(`[Auth] ❌ Failed to migrate server: ${server.name}`)
                  }
                } catch (error) {
                  console.error(`[Auth] Error migrating server ${server.name}:`, error)
                }
              }
              
              // Clear localStorage after successful migration
              localStorage.removeItem("user_servers")
              console.log("[Auth] ✅ Migration complete, localStorage cleared")
              
              // Dispatch event to refresh server lists
              window.dispatchEvent(new Event("userServersUpdated"))
            }
          }
        } catch (error) {
          console.error("[Auth] Error during server migration:", error)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return { error: error?.message || null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Failed to sign in" }
    }
  }

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      })
      return { error: error?.message || null }
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Failed to sign up" }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  const signInWithOAuth = async (provider: "google" | "github") => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signIn,
        signUp,
        signOut,
        signInWithOAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
