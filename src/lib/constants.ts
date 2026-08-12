export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://appet-backend.onrender.com/api/v1"

export const ROUTES = {
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
  PROMOTIONS: "/dashboard/promotions",
  NEW_PROMOTION: "/dashboard/promotions/new",
  EDIT_PROMOTION: (id: string) => `/dashboard/promotions/${id}`,
  PROFILE: "/dashboard/profile",
  CREDITS: "/dashboard/credits",
  RESERVATIONS: "/dashboard/reservations",
  RESERVATION_DETAIL: (id: string) => `/dashboard/reservations/${id}`,
  ADMIN_DASHBOARD: "/admin/dashboard",
  ADMIN_REVIEW: "/admin/review",
  ADMIN_AUDIT_LOGS: "/admin/audit-logs",
  ADMIN_EVENTS: "/admin/events",
  ADMIN_EMERGENCY_CREDITS: "/admin/emergency-credits",
  ADMIN_AD_CREDITS: "/admin/ad-credits",
  ADMIN_PROMOTION_FULFILLMENTS: "/admin/promotion-fulfillments",
  ADMIN_PUBLICATIONS: "/admin/publications",
  ADMIN_REFERRAL_CODES: "/admin/referral-codes",
  ADMIN_PROVIDERS: "/admin/providers",
  ADMIN_APP_USERS: "/admin/users",
  ADMIN_KNOWLEDGE: "/admin/knowledge",
  ADMIN_KNOWLEDGE_DETAIL: (id: string) => `/admin/knowledge/${id}`,
} as const

/** Clases compartidas para filtros del panel admin (alineadas con Auditoría). */
export const ADMIN_FILTER_LABEL_CLASS = "text-xs font-medium text-gray-500"
export const ADMIN_FILTER_INPUT_CLASS =
  "h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
export const ADMIN_FILTER_SELECT_CLASS =
  "h-9 min-w-[220px] rounded-lg border border-gray-300 bg-white px-3 pr-8 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
export const ADMIN_FILTER_PANEL_CLASS =
  "rounded-lg border border-[#e5e7eb] bg-white p-4"

export const KNOWLEDGE_CATEGORIES = [
  "nutrición",
  "vacunas",
  "comportamiento",
  "emergencias",
  "medicamentos",
  "cirugía",
  "razas",
  "otro",
] as const

export const KNOWLEDGE_CATEGORY_COLORS: Record<string, string> = {
  nutrición: "bg-green-100 text-green-800",
  vacunas: "bg-blue-100 text-blue-800",
  comportamiento: "bg-purple-100 text-purple-800",
  emergencias: "bg-red-100 text-red-800",
  medicamentos: "bg-orange-100 text-orange-800",
  cirugía: "bg-pink-100 text-pink-800",
  razas: "bg-yellow-100 text-yellow-800",
  otro: "bg-gray-100 text-gray-800",
}

/** Roles con acceso al panel /admin (backoffice). */
export const ADMIN_ROLES = ["admin"] as const

/** Roles con acceso al panel web kinoo-web-app (proveedor + backoffice). */
export const PANEL_WEB_ROLES = ["provider", "admin"] as const

/**
 * Puntos KYNOO — copy de producto (solo UI).
 * Backend: `users.referral_points`, API `total_points` (moneda de recompensas completa).
 */
export const KYNOO_POINTS_BRAND = "Puntos KYNOO"

export const BENEFIT_TYPE_LABELS: Record<string, string> = {
  discount: "Descuento",
  free_product: "Producto gratis",
  service: "Servicio",
  points_only: "Solo Puntos KYNOO",
}

/** Tipos de beneficio permitidos según el tipo de publicación. */
export const BENEFIT_TYPES_BY_PUBLICATION_TYPE = {
  promotion: ["discount", "free_product", "points_only"],
  service: ["service"],
} as const

export type PublicationType = keyof typeof BENEFIT_TYPES_BY_PUBLICATION_TYPE

export function isBenefitAllowedForPublication(
  publicationType: PublicationType,
  benefitType: string,
): boolean {
  return (
    BENEFIT_TYPES_BY_PUBLICATION_TYPE[publicationType] as readonly string[]
  ).includes(benefitType)
}

export const PROMOTION_STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  inactive: "Inactiva",
  pending_review: "En revisión",
  rejected: "Rechazada",
}

export const PROMOTION_TYPE_LABELS: Record<string, string> = {
  promotion: "Promoción",
  service: "Servicio",
}

export const CREDIT_ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente de pago",
  processing: "Procesando pago",
  paid: "Pagada",
  failed: "Fallida",
  expired: "Expirada",
  refunded: "Reembolsada",
}

export const PROMOTION_PAID_ORDER_STATUS_LABELS: Record<string, string> = {
  ...CREDIT_ORDER_STATUS_LABELS,
  cancelled: "Cancelada",
}

export const FULFILLMENT_PHASE_LABELS: Record<string, string> = {
  pending_contact: "Pendiente de contactar",
  scheduled: "Agendado",
  submitted: "En revisión",
  verified: "Verificado",
  rejected: "Rechazado",
  refunded: "Reembolsada",
  not_applicable: "—",
}

export const FULFILLMENT_STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendado",
  submitted: "En revisión",
  verified: "Verificado",
  rejected: "Rechazado",
}

export const CREDIT_LEDGER_TYPE_LABELS: Record<string, string> = {
  purchase: "Compra",
  spend: "Uso",
  refund: "Reembolso",
  adjustment: "Ajuste",
}

export const PENDING_CREDIT_ORDER_KEY = "kinoo_pending_credit_order_id"
export const PENDING_CREDIT_CHECKOUT_URL_KEY = "kinoo_pending_credit_checkout_url"
