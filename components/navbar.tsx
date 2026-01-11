"use client"
import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useAuth } from "./auth-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Activity, LogOut, MessageSquare, Settings, Plus } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import { ApiKeysSettings } from "@/components/settings-keys"
import { HoverIconButton } from "@/components/ui/hover-icon-button"

export function Navbar() {
  const { user, signOut } = useAuth()
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [googleUser, setGoogleUser] = React.useState<{ email?: string, name?: string, picture?: string } | null>(null)
  const pathname = usePathname()

  const isChatPage = pathname === "/workflows"
  const isRegistryPage = pathname === "/monitoring"

  // Check for Google Workspace user in localStorage
  React.useEffect(() => {
    const loadGoogleUser = () => {
      const storedUser = localStorage.getItem('google_workspace_user')
      if (storedUser) {
        try {
          setGoogleUser(JSON.parse(storedUser))
        } catch (e) {
          console.error('Failed to parse Google user:', e)
        }
      }
    }

    loadGoogleUser()

    // Listen for storage events to refresh when user logs in
    window.addEventListener('storage', loadGoogleUser)
    return () => window.removeEventListener('storage', loadGoogleUser)
  }, [])

  // Use Google user if available, otherwise fall back to regular user
  const displayUser = googleUser ? {
    name: googleUser.name || googleUser.email || 'Google User',
    email: googleUser.email || '',
    avatar_url: googleUser.picture || ''
  } : user

  const avatarImageClassName = displayUser?.avatar_url ? undefined : "dark:invert"

  return (
    <nav className="border-b border-border/40 bg-card/50 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="https://automationalien.s3.us-east-1.amazonaws.com/ChatGPT+Image+Jun+23%2C+2025%2C+03_53_12+PM.png"
              alt="Project Nexus"
              width={32}
              height={32}
              className="h-8 w-auto rounded-sm"
            />
            <span className="hidden text-lg font-semibold text-foreground sm:inline-block">Project Nexus</span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {!isChatPage && (
              <HoverIconButton asChild className="h-9 w-9">
                <Link href="/workflows" title="Chat">
                  <MessageSquare className="h-[18px] w-[18px]" />
                </Link>
              </HoverIconButton>
            )}
            {!isRegistryPage && (
              <HoverIconButton asChild className="h-9 w-9">
                <Link href="/monitoring" title="Registry">
                  <Activity className="h-[18px] w-[18px]" />
                </Link>
              </HoverIconButton>
            )}
            <HoverIconButton asChild className="h-9 w-9">
              <Link href="/monitoring?addServer=true" title="Add Server">
                <Plus className="h-[18px] w-[18px]" />
              </Link>
            </HoverIconButton>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div suppressHydrationWarning>
            <ModeToggle />
          </div>


          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <HoverIconButton className="h-9 w-9">
                <Avatar className="h-7 w-7">
                  <AvatarImage
                    src={displayUser?.avatar_url || "/placeholder-user.svg"}
                    alt={displayUser?.name || "Guest"}
                    className={avatarImageClassName}
                  />
                  <AvatarFallback className="text-xs text-foreground">
                    {displayUser ? displayUser.name.charAt(0).toUpperCase() : "G"}
                  </AvatarFallback>
                </Avatar>
              </HoverIconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{displayUser?.name || "Guest"}</p>
                  {displayUser?.email && (
                    <p className="text-xs leading-none text-muted-foreground">{displayUser.email}</p>
                  )}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              {displayUser && (
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => signOut()}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <ApiKeysSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
    </nav>
  )
}
