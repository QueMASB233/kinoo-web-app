"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { AuthProvider } from "@/providers/auth-provider"
import { ProviderCreditsProvider } from "@/providers/provider-credits-provider"
import { useAuth } from "@/hooks/use-auth"
import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { panelHomeForRole } from "@/lib/admin-access"
import { ROUTES } from "@/lib/constants"
import { getAccessToken } from "@/lib/auth"
import { Skeleton } from "@/components/ui/skeleton"

function DashboardGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      const token = getAccessToken()
      if (!token) {
        router.push(ROUTES.LOGIN)
      }
      return
    }
    if (user.role_code === "operator_igs" || user.role_code === "operator") {
      router.replace(panelHomeForRole(user.role_code) || ROUTES.LOGIN)
    }
  }, [isLoading, user, router])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="space-y-4 w-[300px] text-center">
          <Skeleton className="h-8 w-32 mx-auto" />
          <Skeleton className="h-4 w-48 mx-auto" />
          <Skeleton className="h-4 w-40 mx-auto" />
          <p className="text-sm text-muted-foreground pt-2">
            Cargando panel de proveedor...
          </p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <ProviderCreditsProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 md:ml-[240px] flex flex-col">
          <Topbar />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </ProviderCreditsProvider>
  )
}

export function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthProvider>
      <DashboardGuard>{children}</DashboardGuard>
    </AuthProvider>
  )
}
