
import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const url = searchParams.get("url")

    if (!url) {
        return new NextResponse("Missing url parameter", { status: 400 })
    }

    // Parse the target URL to extract the state parameter
    let state: string | null = null
    try {
        const targetUrl = new URL(url)
        state = targetUrl.searchParams.get("state")
    } catch (e) {
        return new NextResponse("Invalid URL", { status: 400 })
    }

    if (!state) {
        return new NextResponse("Missing state in target URL", { status: 400 })
    }

    // Create response with redirect
    const response = NextResponse.redirect(url)

    // Set the secure HTTP-only cookie
    // Note: We need to await cookies() in Next.js 15 (if used), but standard in 14 it's synchronous-ish or awaitable.
    // Using response.cookies.set is the standard middleware/route handler way for the *response*.
    response.cookies.set("oauth_state", state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax", // Lax is usually required for OAuth redirects to work properly
        path: "/",
        maxAge: 3600, // 1 hour
    })

    return response
}
