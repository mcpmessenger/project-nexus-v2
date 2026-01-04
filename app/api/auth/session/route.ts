import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

// Get Supabase URL and anon key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321"
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get("sb-access-token")?.value
    const refreshToken = cookieStore.get("sb-refresh-token")?.value

    // Create Supabase client with cookies
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })

    // Set session from cookies if available
    if (accessToken && refreshToken) {
      const { data: { user }, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      })

      if (user && !error) {
        return NextResponse.json({
          user: {
            id: user.id,
            email: user.email || "",
            name: user.user_metadata?.full_name || 
                  user.user_metadata?.name || 
                  user.email?.split("@")[0] || 
                  "User",
            org_id: user.user_metadata?.org_id || `org-${user.id}`,
            avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture,
          },
        })
      }
    }

    // Try to get current session
    const { data: { session }, error } = await supabase.auth.getSession()

    if (session?.user) {
      return NextResponse.json({
        user: {
          id: session.user.id,
          email: session.user.email || "",
          name: session.user.user_metadata?.full_name || 
                session.user.user_metadata?.name || 
                session.user.email?.split("@")[0] || 
                "User",
          org_id: session.user.user_metadata?.org_id || `org-${session.user.id}`,
          avatar_url: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture,
        },
      })
    }

    return NextResponse.json({ user: null })
  } catch (error) {
    console.error("Session error:", error)
    return NextResponse.json(
      { error: "Failed to get session", user: null },
      { status: 500 }
    )
  }
}
