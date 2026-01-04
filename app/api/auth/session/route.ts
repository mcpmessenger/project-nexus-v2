import { NextResponse } from "next/server"

// Mock session endpoint for development
// In production: integrate with OAuth2 provider (Auth0, Okta, etc.)

export async function GET() {
  // Mock authenticated user
  const mockUser = {
    id: "user-123",
    email: "demo@projectnexus.dev",
    name: "Demo User",
    org_id: "org-123",
    avatar_url: "/demo-user-icon.svg",
  }

  return NextResponse.json({ user: mockUser })
}
