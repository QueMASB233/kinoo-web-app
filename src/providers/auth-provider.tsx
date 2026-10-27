"use client"

import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import { api, ApiError } from "@/lib/api-client"
import { getAccessToken, setTokens, clearTokens } from "@/lib/auth"
import { panelHomeForRole } from "@/lib/admin-access"
import { ROUTES, PANEL_WEB_ROLES } from "@/lib/constants"
import type { UserResponse } from "@/types"

interface AuthContextType {
  user: UserResponse | null
  isLoading: boolean
  login: (email: string) => Promise<void>
  verifyOtp: (email: string, code: string) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  const fetchUser = useCallback(async () => {
    try {
      const userData = await api.users.me()
      if (
        userData.role_code &&
        PANEL_WEB_ROLES.includes(
          userData.role_code as (typeof PANEL_WEB_ROLES)[number],
        )
      ) {
        setUser(userData)
      } else {
        clearTokens()
        setUser(null)
      }
    } catch {
      clearTokens()
      setUser(null)
    }
  }, [])

  useEffect(() => {
    const token = getAccessToken()
    if (token) {
      fetchUser().finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [fetchUser])

  const login = useCallback(async (email: string) => {
    await api.auth.login(email)
  }, [])

  const verifyOtp = useCallback(
    async (email: string, code: string) => {
      const tokenData = await api.auth.verifyCode(email, code)
      setTokens(tokenData.access_token, tokenData.refresh_token)

      const userData = await api.users.me()
      if (
        userData.role_code &&
        PANEL_WEB_ROLES.includes(
          userData.role_code as (typeof PANEL_WEB_ROLES)[number],
        )
      ) {
        setUser(userData)
        router.push(panelHomeForRole(userData.role_code) || ROUTES.LOGIN)
      } else {
        clearTokens()
        throw new ApiError(
          403,
          "No tienes permisos de proveedor. Contacta al administrador.",
        )
      }
    },
    [router],
  )

  const logout = useCallback(() => {
    clearTokens()
    setUser(null)
    router.push(ROUTES.LOGIN)
  }, [router])

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, verifyOtp, logout, refreshUser: fetchUser }}
    >
      {children}
    </AuthContext.Provider>
  )
}
