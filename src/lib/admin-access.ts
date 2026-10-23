import { ROUTES } from "@/lib/constants"

export type AdminPanelRole = "admin" | "operator_igs" | "operator"

const ADMIN_PREFIXES = [
  ROUTES.ADMIN_DASHBOARD,
  ROUTES.ADMIN_REVIEW,
  ROUTES.ADMIN_AUDIT_LOGS,
  ROUTES.ADMIN_EVENTS,
  ROUTES.ADMIN_EMERGENCY_CREDITS,
  ROUTES.ADMIN_AD_CREDITS,
  ROUTES.ADMIN_PROMOTION_FULFILLMENTS,
  ROUTES.ADMIN_PUBLICATIONS,
  ROUTES.ADMIN_ACTIVE_SUBSCRIPTIONS,
  ROUTES.ADMIN_KYNOO_REDEMPTIONS,
  ROUTES.ADMIN_REFERRAL_CODES,
  ROUTES.ADMIN_PROVIDERS,
  ROUTES.ADMIN_TEAM,
  ROUTES.ADMIN_APP_USERS,
  ROUTES.ADMIN_KNOWLEDGE,
]

const ROLE_PREFIXES: Record<AdminPanelRole, readonly string[]> = {
  admin: ADMIN_PREFIXES,
  operator_igs: [
    ROUTES.ADMIN_ACTIVE_SUBSCRIPTIONS,
    ROUTES.ADMIN_EMERGENCY_CREDITS,
  ],
  operator: [
    ROUTES.ADMIN_KYNOO_REDEMPTIONS,
    ROUTES.ADMIN_AD_CREDITS,
    ROUTES.ADMIN_PROMOTION_FULFILLMENTS,
    ROUTES.ADMIN_EMERGENCY_CREDITS,
  ],
}

export function isAdminPanelRole(role: string | null | undefined): role is AdminPanelRole {
  return role === "admin" || role === "operator_igs" || role === "operator"
}

export function panelHomeForRole(role: string | null | undefined): string | null {
  if (role === "admin") return ROUTES.ADMIN_DASHBOARD
  if (role === "operator_igs") return ROUTES.ADMIN_ACTIVE_SUBSCRIPTIONS
  if (role === "operator") return ROUTES.ADMIN_KYNOO_REDEMPTIONS
  if (role === "provider") return ROUTES.PROMOTIONS
  return null
}

export function adminPathAllowed(
  role: string | null | undefined,
  pathname: string,
): boolean {
  if (!isAdminPanelRole(role)) return false
  return ROLE_PREFIXES[role].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function adminRoleLabel(role: string | null | undefined): string {
  if (role === "operator_igs") return "Operador IGS"
  if (role === "operator") return "Operador"
  return "Admin"
}
