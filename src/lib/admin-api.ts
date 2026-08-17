import { apiClient } from "./api-client"
import { getAccessToken } from "./auth"
import { API_BASE_URL } from "./constants"
import type {
  DashboardSummary,
  UsersAnalytics,
  PetsAnalytics,
  PromotionsAnalytics,
  PointsAnalytics,
  ReferralsAnalytics,
  EngagementAnalytics,
  EmergencyCreditsAnalytics,
  PaginatedAuditLogs,
  PaginatedEvents,
  PaginatedActiveCredits,
  AdminEmergencyCreditOrderList,
  AdminEmergencyCreditOrderRefundResponse,
  PaginatedKnowledgeDocuments,
  KnowledgeDocumentResponse,
  KnowledgeDocumentDetail,
  KnowledgeDocumentUpdate,
  Promotion,
  PromotionReviewAction,
  AdminProviderCreditOrderList,
  ProviderCreditOrderRefundResponse,
  AdminPromotionOrderFulfillmentList,
  AdminPromotionOrderFulfillmentDetail,
  AdminPromotionPaidOrderSummary,
  AdminPromotionPaidOrderList,
  AdminPromotionPaidOrderRefundResponse,
  PromotionFulfillmentReviewAction,
  AdminProviderList,
  AdminCreateProviderRequest,
  AdminCreateProviderResponse,
  AdminUpdateProviderRequest,
  AdminUpdateProviderResponse,
  AdminAppUserList,
  AdminUpdateAppUserRequest,
  AdminUpdateAppUserResponse,
  AdminReferralCode,
  AdminCreateReferralCodeRequest,
  AdminUpdateReferralCodeRequest,
} from "@/types"

function buildQuery(params: Record<string, unknown>): string {
  const qs = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") qs.set(k, String(v))
  })
  const str = qs.toString()
  return str ? `?${str}` : ""
}

export const adminApi = {
  providers: {
    list: (params?: {
      search?: string
      page?: number
      limit?: number
    }) =>
      apiClient<AdminProviderList>(`/admin/providers${buildQuery(params || {})}`),

    create: (data: AdminCreateProviderRequest) =>
      apiClient<AdminCreateProviderResponse>("/admin/providers", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (id: string, data: AdminUpdateProviderRequest) =>
      apiClient<AdminUpdateProviderResponse>(`/admin/providers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },

  appUsers: {
    list: (params?: {
      role?: string
      search?: string
      page?: number
      limit?: number
    }) =>
      apiClient<AdminAppUserList>(`/admin/app-users${buildQuery(params || {})}`),

    update: (id: string, data: AdminUpdateAppUserRequest) =>
      apiClient<AdminUpdateAppUserResponse>(`/admin/app-users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },

  dashboard: {
    summary: () => apiClient<DashboardSummary>("/admin/dashboard/summary"),
    users: () => apiClient<UsersAnalytics>("/admin/dashboard/users"),
    pets: () => apiClient<PetsAnalytics>("/admin/dashboard/pets"),
    promotions: () =>
      apiClient<PromotionsAnalytics>("/admin/dashboard/promotions"),
    points: () => apiClient<PointsAnalytics>("/admin/dashboard/points"),
    referrals: () =>
      apiClient<ReferralsAnalytics>("/admin/dashboard/referrals"),
    engagement: () =>
      apiClient<EngagementAnalytics>("/admin/dashboard/engagement"),
    emergencyCredits: () =>
      apiClient<EmergencyCreditsAnalytics>(
        "/admin/dashboard/emergency-credits",
      ),
  },

  auditLogs: (params: {
    page?: number
    limit?: number
    table_name?: string
    action?: string
    search?: string
    date_from?: string
    date_to?: string
  }) => apiClient<PaginatedAuditLogs>(`/admin/audit-logs${buildQuery(params)}`),

  events: (params: {
    page?: number
    limit?: number
    event_type?: string
    entity_type?: string
    search?: string
    date_from?: string
    date_to?: string
  }) => apiClient<PaginatedEvents>(`/admin/events${buildQuery(params)}`),

  credits: (params: {
    page?: number
    limit?: number
    status?: string
    search?: string
    sort_by?: string
    sort_order?: string
  }) =>
    apiClient<PaginatedActiveCredits>(
      `/admin/emergency-credits${buildQuery(params)}`,
    ),

  activeCredits: (params: { page?: number; limit?: number }) =>
    apiClient<PaginatedActiveCredits>(
      `/admin/emergency-credits/active${buildQuery(params)}`,
    ),

  closeEmergencyCreditAttended: (creditId: string) =>
    apiClient<{ success: boolean; message: string; credit_id: string }>(
      `/admin/emergency-credits/${creditId}/close-attended`,
      { method: "POST" },
    ),

  releaseEmergencyCreditCall: (creditId: string) =>
    apiClient<{ success: boolean; message: string; credit_id: string }>(
      `/admin/emergency-credits/${creditId}/release`,
      { method: "POST" },
    ),

  emergencyOrders: {
    list: (params: {
      limit?: number
      offset?: number
      status?: string
      search?: string
    }) =>
      apiClient<AdminEmergencyCreditOrderList>(
        `/admin/emergency-orders${buildQuery(params)}`,
      ),

    refund: (
      orderId: string,
      data: { reason: string; force?: boolean },
    ) =>
      apiClient<AdminEmergencyCreditOrderRefundResponse>(
        `/admin/emergency-orders/${orderId}/refund`,
        { method: "POST", body: JSON.stringify(data) },
      ),
  },

  knowledge: {
    list: (params?: {
      page?: number
      limit?: number
      category?: string
      status?: string
      search?: string
    }) =>
      apiClient<PaginatedKnowledgeDocuments>(
        `/admin/knowledge/documents${buildQuery(params || {})}`,
      ),

    get: (id: string) =>
      apiClient<KnowledgeDocumentDetail>(
        `/admin/knowledge/documents/${id}`,
      ),

    upload: async (
      file: File,
      title: string,
      description?: string,
      category?: string,
    ): Promise<KnowledgeDocumentResponse> => {
      const params = new URLSearchParams({ title })
      if (description) params.set("description", description)
      if (category) params.set("category", category)

      const form = new FormData()
      form.append("file", file)

      const token = getAccessToken()
      const res = await fetch(
        `${API_BASE_URL}/admin/knowledge/documents?${params.toString()}`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        },
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || "Error al subir documento")
      }
      return res.json()
    },

    update: (id: string, data: KnowledgeDocumentUpdate) =>
      apiClient<KnowledgeDocumentResponse>(
        `/admin/knowledge/documents/${id}`,
        { method: "PATCH", body: JSON.stringify(data) },
      ),

    delete: (id: string) =>
      apiClient<void>(`/admin/knowledge/documents/${id}`, {
        method: "DELETE",
      }),

    reprocess: (id: string) =>
      apiClient<KnowledgeDocumentResponse>(
        `/admin/knowledge/documents/${id}/reprocess`,
        { method: "POST" },
      ),
  },

  adCredits: {
    listOrders: (params: {
      limit?: number
      offset?: number
      status?: string
      search?: string
      date_from?: string
      date_to?: string
    }) =>
      apiClient<AdminProviderCreditOrderList>(
        `/admin/credits/orders${buildQuery(params)}`,
      ),

    exportOrdersCsv: async (params: {
      status?: string
      search?: string
      provider_id?: string
      provider_search?: string
      date_from?: string
      date_to?: string
    }) => {
      const token = getAccessToken()
      const res = await fetch(
        `${API_BASE_URL}/admin/credits/orders/export.csv${buildQuery(params)}`,
        {
          method: "GET",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || "Error al exportar CSV")
      }
      return res.blob()
    },

    refundOrder: (orderId: string) =>
      apiClient<ProviderCreditOrderRefundResponse>(
        `/admin/credits/orders/${orderId}/refund`,
        { method: "POST" },
      ),

    listPacks: () =>
      apiClient<{
        packs: Array<{
          id: string
          slug: string
          label: string
          amount_usd: number | string
          credits: number | string
          description: string
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }>
        settings: import("@/types").CustomPurchaseSettings
      }>("/admin/credits/packs"),

    createPack: (data: {
      slug: string
      label: string
      amount_usd: number
      credits: number
      description?: string
      sort_order?: number
      is_active?: boolean
    }) =>
      apiClient("/admin/credits/packs", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updatePack: (
      packId: string,
      data: Partial<{
        label: string
        amount_usd: number
        credits: number
        description: string
        sort_order: number
        is_active: boolean
      }>,
    ) =>
      apiClient(`/admin/credits/packs/${packId}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    updatePurchaseSettings: (data: Partial<{
      credits_per_usd: number
      min_custom_credits: number
      max_custom_credits: number
      custom_enabled: boolean
    }>) =>
      apiClient<import("@/types").CustomPurchaseSettings>(
        "/admin/credits/purchase-settings",
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      ),
  },

  promotionReview: {
    listPending: (params?: { search?: string }) =>
      apiClient<Promotion[]>(
        `/admin/promotions/pending${params ? buildQuery(params) : ""}`,
      ),
    review: (promotionId: string, data: PromotionReviewAction) =>
      apiClient<Promotion>(`/admin/promotions/${promotionId}/review`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  publications: {
    list: (params?: { search?: string; include_inactive?: boolean }) =>
      apiClient<Promotion[]>(
        `/admin/promotions${buildQuery({
          include_inactive: true,
          ...params,
        })}`,
      ),
    setAdminSuspension: (
      promotionId: string,
      data: { suspended: boolean; reason?: string | null },
    ) =>
      apiClient<Promotion>(
        `/admin/promotions/${promotionId}/admin-suspension`,
        {
          method: "PATCH",
          body: JSON.stringify(data),
        },
      ),
  },

  referralCodes: {
    list: (params?: { search?: string; active_only?: boolean }) =>
      apiClient<AdminReferralCode[]>(
        `/admin/referral-codes${buildQuery(params || {})}`,
      ),

    get: (id: string) =>
      apiClient<AdminReferralCode>(`/admin/referral-codes/${id}`),

    create: (data: AdminCreateReferralCodeRequest) =>
      apiClient<AdminReferralCode>("/admin/referral-codes", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (id: string, data: AdminUpdateReferralCodeRequest) =>
      apiClient<AdminReferralCode>(`/admin/referral-codes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },

  promotionFulfillments: {
    list: (params: {
      limit?: number
      offset?: number
      status?: string
      search?: string
      provider_search?: string
      submitted_from?: string
      submitted_to?: string
    }) =>
      apiClient<AdminPromotionOrderFulfillmentList>(
        `/admin/promotion-fulfillments${buildQuery(params)}`,
      ),

    get: (fulfillmentId: string) =>
      apiClient<AdminPromotionOrderFulfillmentDetail>(
        `/admin/promotion-fulfillments/${fulfillmentId}`,
      ),

    review: (fulfillmentId: string, data: PromotionFulfillmentReviewAction) =>
      apiClient<AdminPromotionOrderFulfillmentDetail>(
        `/admin/promotion-fulfillments/${fulfillmentId}`,
        { method: "PATCH", body: JSON.stringify(data) },
      ),

    exportCsv: async (params: {
      status?: string
      search?: string
      provider_id?: string
      provider_search?: string
      submitted_from?: string
      submitted_to?: string
    }) => {
      const token = getAccessToken()
      const res = await fetch(
        `${API_BASE_URL}/admin/promotion-fulfillments/export.csv${buildQuery(params)}`,
        {
          method: "GET",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || "Error al exportar CSV")
      }
      return res.blob()
    },
  },

  promotionOrders: {
    list: (params: {
      limit?: number
      offset?: number
      status?: string
      fulfillment_phase?: string
      search?: string
      date_from?: string
      date_to?: string
    }) =>
      apiClient<AdminPromotionPaidOrderList>(
        `/admin/promotion-orders${buildQuery(params)}`,
      ),

    get: (orderId: string) =>
      apiClient<AdminPromotionPaidOrderSummary>(
        `/admin/promotion-orders/${orderId}`,
      ),

    refund: (
      orderId: string,
      data: { reason: string; force?: boolean },
    ) =>
      apiClient<AdminPromotionPaidOrderRefundResponse>(
        `/admin/promotion-orders/${orderId}/refund`,
        { method: "POST", body: JSON.stringify(data) },
      ),
  },
}
