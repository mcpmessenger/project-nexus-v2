import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321"
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

/**
 * Get authenticated user from Supabase session in API routes
 */
export async function getAuthenticatedUser() {
  try {
    const cookieStore = await cookies()
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })

    // Try to get session from cookies
    // Supabase sets cookies with pattern: sb-<project-ref>-auth-token
    const allCookies = cookieStore.getAll()
    const authCookie = allCookies.find(c => c.name.includes('auth-token'))
    
    if (authCookie) {
      // Parse the session from cookie
      try {
        const sessionData = JSON.parse(decodeURIComponent(authCookie.value))
        if (sessionData?.access_token) {
          const { data: { user }, error } = await supabase.auth.setSession({
            access_token: sessionData.access_token,
            refresh_token: sessionData.refresh_token,
          })
          if (user && !error) {
            return user
          }
        }
      } catch (e) {
        // Cookie format might be different, try getSession
      }
    }

    // Fallback: try getSession
    const { data: { session }, error } = await supabase.auth.getSession()
    if (session?.user && !error) {
      return session.user
    }

    return null
  } catch (error) {
    console.error("[getAuthenticatedUser] Error:", error)
    return null
  }
}

/**
 * Get Supabase client with user session for authenticated requests
 */
export async function getSupabaseClient() {
  const cookieStore = await cookies()
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: {
        getItem: (key: string) => {
          const allCookies = cookieStore.getAll()
          const cookie = allCookies.find(c => 
            c.name.includes('auth-token') || c.name.includes('supabase')
          )
          return cookie ? cookie.value : null
        },
        setItem: () => {},
        removeItem: () => {},
      },
    },
  })
  
  return supabase
}
