"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { api } from "@/lib/api-client"
import { getAccessToken, clearTokens } from "@/lib/auth"
import { ROUTES } from "@/lib/constants"
import {
  adminPathAllowed,
  isAdminPanelRole,
  panelHomeForRole,
} from "@/lib/admin-access"
import { AdminSidebar } from "@/components/admin/admin-sidebar"
import { AdminProvider } from "@/providers/admin-provider"
import type { UserResponse } from "@/types"

export function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<UserResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function verify() {
      const token = getAccessToken()
      if (!token) {
        router.push(ROUTES.LOGIN)
        return
      }

      try {
        const userData = await api.users.me()
        if (!isAdminPanelRole(userData.role_code)) {
          router.push(panelHomeForRole(userData.role_code) || ROUTES.LOGIN)
          return
        }
        setUser(userData)
      } catch {
        clearTokens()
        router.push(ROUTES.LOGIN)
      } finally {
        setIsLoading(false)
      }
    }

    verify()
  }, [router])

  useEffect(() => {
    if (!user?.role_code) return
    if (adminPathAllowed(user.role_code, pathname)) return
    router.replace(panelHomeForRole(user.role_code) || ROUTES.LOGIN)
  }, [user, pathname, router])

  function handleLogout() {
    clearTokens()
    router.push(ROUTES.LOGIN)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f9fa]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
          <p className="text-sm text-gray-500">Cargando panel de administración...</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <AdminProvider user={user}>
      <div className="min-h-screen bg-[#f8f9fa]">
        <AdminSidebar
          userName={user.full_name || user.email}
          roleCode={user.role_code}
          homeHref={panelHomeForRole(user.role_code) || ROUTES.ADMIN_DASHBOARD}
          onLogout={handleLogout}
        />
        <main className="md:ml-[240px] min-h-screen">
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </AdminProvider>
  )
}
