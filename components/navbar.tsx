"use client"
import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useAuth } from "./auth-provider"
import { useTheme } from "./theme-provider"
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
import { Activity, LayoutDashboard, Network, LogOut, Moon, Sun, MessageSquare, Settings, Plus } from "lucide-react"
import { ApiKeysSettings } from "@/components/settings-keys"
import { HoverIconButton } from "@/components/ui/hover-icon-button"

export function Navbar() {
  const { user, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const pathname = usePathname()

  const isChatPage = pathname === "/workflows"
  const isRegistryPage = pathname === "/monitoring"
  const avatarImageClassName = user?.avatar_url ? undefined : "dark:invert"

  return (
    <nav className="border-b border-border/40 bg-card/50 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/chatgpt-20image-20jun-2023-2c-202025-2c-2003-53-12-20pm.png"
              alt="Project Nexus"
              width={28}
              height={28}
              className="h-7 w-7"
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
            <HoverIconButton onClick={toggleTheme} className="h-9 w-9" title="Toggle theme">
              {theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
            </HoverIconButton>
          </div>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <HoverIconButton className="h-9 w-9">
                  <Avatar className="h-7 w-7">
                    <AvatarImage
                      src={user.avatar_url || "/placeholder-user.svg"}
                      alt={user.name}
                      className={avatarImageClassName}
                    />
                    <AvatarFallback className="text-xs text-foreground">{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </HoverIconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={() => signOut()}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <HoverIconButton 
              onClick={() => setSettingsOpen(true)}
              className="h-9 w-9"
              title="Settings"
            >
              <Settings className="h-[18px] w-[18px]" />
            </HoverIconButton>
          )}
        </div>
      </div>
      <ApiKeysSettings open={settingsOpen} onOpenChange={setSettingsOpen} />
    </nav>
  )
}
