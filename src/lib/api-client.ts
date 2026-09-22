import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "./auth"
import { API_BASE_URL, ROUTES } from "./constants"
import { PROMOTION_VIDEO_UPLOAD_TIMEOUT_MS } from "./promotion-video"
import type { TokenResponse } from "@/types"

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public title?: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

function parseApiErrorDetail(detail: unknown): { message: string; title?: string } {
  if (typeof detail === "string" && detail.trim()) {
    return { message: detail.trim() }
  }
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const payload = detail as { message?: string; title?: string }
    const message =
      typeof payload.message === "string" && payload.message.trim()
        ? payload.message.trim()
        : null
    if (message) {
      const title =
        typeof payload.title === "string" && payload.title.trim()
          ? payload.title.trim()
          : undefined
      return { message, title }
    }
  }
  if (Array.isArray(detail)) {
    const message = detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          const loc = Array.isArray((item as { loc?: unknown }).loc)
            ? (item as { loc: unknown[] }).loc.join(".")
            : ""
          return loc ? `${loc}: ${(item as { msg: string }).msg}` : (item as { msg: string }).msg
        }
        return String(item)
      })
      .join("; ")
    return { message }
  }
  return { message: "Error en la solicitud" }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!res.ok) return null

    const data: TokenResponse = await res.json()
    setTokens(data.access_token, data.refresh_token)
    return data.access_token
  } catch {
    return null
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken()

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }

  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData
  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json"
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const doFetch = async (authHeaders: Record<string, string>) =>
    fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: authHeaders,
    })

  let res = await doFetch(headers)

  if (res.status === 401) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      headers["Authorization"] = `Bearer ${newToken}`
      res = await doFetch(headers)
    } else {
      clearTokens()
      if (typeof window !== "undefined") {
        window.location.href = ROUTES.LOGIN
      }
      throw new ApiError(401, "Sesión expirada")
    }
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    const parsed = parseApiErrorDetail(errorBody.detail)
    throw new ApiError(res.status, parsed.message, parsed.title)
  }

  if (res.status === 204) return undefined as T

  return res.json()
}

/** Fetch con timeout vía AbortController (p. ej. subida de video). */
async function apiClientWithTimeout<T>(
  endpoint: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController()
  const external = options.signal
  const onExternalAbort = () => controller.abort()
  if (external) {
    if (external.aborted) {
      controller.abort()
    } else {
      external.addEventListener("abort", onExternalAbort, { once: true })
    }
  }

  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await apiClient<T>(endpoint, {
      ...options,
      signal: controller.signal,
    })
  } catch (err) {
    if (
      err instanceof DOMException &&
      err.name === "AbortError"
    ) {
      throw new ApiError(
        408,
        "La subida tardó demasiado. Prueba con un video más liviano o mejor conexión.",
        "Tiempo de espera",
      )
    }
    throw err
  } finally {
    clearTimeout(timer)
    if (external) {
      external.removeEventListener("abort", onExternalAbort)
    }
  }
}

// ─── API Methods ─────────────────────────────────────────

export const api = {
  auth: {
    login: (email: string) =>
      apiClient<{ message: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email }),
      }),
    verifyCode: (email: string, code: string) =>
      apiClient<TokenResponse>("/auth/verify-register", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      }),
  },

  users: {
    me: () => apiClient<import("@/types").UserResponse>("/users/me"),
    updateProfile: (data: Record<string, unknown>) =>
      apiClient<import("@/types").UserResponse>("/users/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },

  promotions: {
    list: (includeInactive = true) =>
      apiClient<import("@/types").Promotion[]>(
        `/admin/promotions?include_inactive=${includeInactive}`,
      ),
    get: (id: string) =>
      apiClient<import("@/types").Promotion>(`/admin/promotions/${id}`),
    create: (
      data: import("@/types").CreatePromotionRequest,
      photo?: File | null,
      video?: File | null,
      videoThumbnail?: File | null,
    ) => {
      const form = new FormData()
      form.append("data", JSON.stringify(data))
      if (photo) form.append("photo", photo)
      if (video) form.append("video", video)
      if (videoThumbnail) form.append("video_thumbnail", videoThumbnail)
      const request = {
        method: "POST" as const,
        body: form,
      }
      if (video) {
        return apiClientWithTimeout<import("@/types").Promotion>(
          "/admin/promotions",
          request,
          PROMOTION_VIDEO_UPLOAD_TIMEOUT_MS,
        )
      }
      return apiClient<import("@/types").Promotion>("/admin/promotions", request)
    },
    update: (
      id: string,
      data: import("@/types").UpdatePromotionRequest,
      photo?: File | null,
      video?: File | null,
      videoThumbnail?: File | null,
    ) => {
      const form = new FormData()
      form.append("data", JSON.stringify(data))
      if (photo) form.append("photo", photo)
      if (video) form.append("video", video)
      if (videoThumbnail) form.append("video_thumbnail", videoThumbnail)
      const request = {
        method: "PUT" as const,
        body: form,
      }
      if (video) {
        return apiClientWithTimeout<import("@/types").Promotion>(
          `/admin/promotions/${id}`,
          request,
          PROMOTION_VIDEO_UPLOAD_TIMEOUT_MS,
        )
      }
      return apiClient<import("@/types").Promotion>(
        `/admin/promotions/${id}`,
        request,
      )
    },
    patch: (id: string, data: import("@/types").UpdatePromotionRequest) =>
      apiClient<import("@/types").Promotion>(`/admin/promotions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  },

  lookup: {
    countries: () =>
      apiClient<import("@/types").Country[]>("/lookup/countries"),
    cities: (countryId: string) =>
      apiClient<import("@/types").City[]>(
        `/lookup/cities?country_id=${countryId}`,
      ),
  },

  places: {
    search: (query: string) =>
      apiClient<{ data: import("@/types").PlaceResult[] }>(
        `/places/search?q=${encodeURIComponent(query)}`,
      ),
    fromCoordinates: (lat: number, lng: number) =>
      apiClient<{ data: import("@/types").PlaceResult }>(
        "/places/from-coordinates",
        {
          method: "POST",
          body: JSON.stringify({ lat, lng }),
        },
      ),
  },

  locations: {
    list: (promotionId: string) =>
      apiClient<import("@/types").PromotionLocation[]>(
        `/promotions/${promotionId}/locations`,
      ),
    add: (promotionId: string, placeId: string, coverageType: import("@/types").CoverageType = "point") =>
      apiClient<import("@/types").PromotionLocation>(
        `/promotions/${promotionId}/locations`,
        {
          method: "POST",
          body: JSON.stringify({ place_id: placeId, coverage_type: coverageType }),
        },
      ),
    remove: (promotionId: string, locationId: string) =>
      apiClient<void>(`/promotions/${promotionId}/locations/${locationId}`, {
        method: "DELETE",
      }),
  },

  pets: {
    breeds: (species: string) =>
      apiClient<import("@/types").Breed[]>(
        `/pets/breeds?species=${encodeURIComponent(species)}`,
      ),
  },

  credits: {
    locationPricing: () =>
      apiClient<import("@/types").AdCreditLocationPricing>(
        "/provider/credits/location-pricing",
      ),
    packs: () =>
      apiClient<import("@/types").CreditPackListResponse>(
        "/provider/credits/packs",
      ),
    balance: () =>
      apiClient<import("@/types").ProviderCreditBalance>(
        "/provider/credits/balance",
      ),
    transactions: (limit = 20, offset = 0) =>
      apiClient<import("@/types").ProviderCreditTransactionList>(
        `/provider/credits/transactions?limit=${limit}&offset=${offset}`,
      ),
    createOrder: (
      payload: { pack_id: string } | { credits: number },
      idempotencyKey?: string,
    ) => {
      const headers: Record<string, string> = {}
      if (idempotencyKey) {
        headers["Idempotency-Key"] = idempotencyKey
      }
      return apiClient<import("@/types").ProviderCreditOrderCreateResponse>(
        "/provider/credits/orders",
        {
          method: "POST",
          body: JSON.stringify(payload),
          headers,
        },
      )
    },
    getOrder: (orderId: string) =>
      apiClient<import("@/types").ProviderCreditOrder>(
        `/provider/credits/orders/${orderId}`,
      ),
  },

  reservations: {
    list: (
      limit = 25,
      offset = 0,
      status?: string,
      search?: string,
      fulfillmentPhase?: string,
      dateFrom?: string,
      dateTo?: string,
    ) => {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      })
      if (status) params.set("order_status", status)
      if (search?.trim()) params.set("search", search.trim())
      if (fulfillmentPhase) params.set("fulfillment_phase", fulfillmentPhase)
      if (dateFrom) params.set("date_from", dateFrom)
      if (dateTo) params.set("date_to", dateTo)
      return apiClient<import("@/types").PromotionPaidOrderListResponse>(
        `/provider/promotion-orders?${params.toString()}`,
      )
    },

    exportCsv: async (params: {
      order_status?: string
      fulfillment_phase?: string
      search?: string
      date_from?: string
      date_to?: string
    }) => {
      const qs = new URLSearchParams()
      Object.entries(params).forEach(([k, v]) => {
        if (v != null && v !== "") qs.set(k, String(v))
      })
      const token = getAccessToken()
      const query = qs.toString()
      const res = await fetch(
        `${API_BASE_URL}/provider/promotion-orders/export.csv${query ? `?${query}` : ""}`,
        {
          method: "GET",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(
          typeof err.detail === "string"
            ? err.detail
            : "Error al exportar CSV",
        )
      }
      return res.blob()
    },
    get: (orderId: string) =>
      apiClient<import("@/types").PromotionPaidOrder>(
        `/provider/promotion-orders/${orderId}`,
      ),
    confirmContact: (orderId: string, schedulingNotes?: string) =>
      apiClient<import("@/types").PromotionOrderFulfillment>(
        `/provider/promotion-orders/${orderId}/fulfillment/contact`,
        {
          method: "POST",
          body: JSON.stringify({
            scheduling_notes: schedulingNotes?.trim() || null,
          }),
        },
      ),
    submitDelivery: async (
      orderId: string,
      photo: File,
      deliveryDescription: string,
    ) => {
      const form = new FormData()
      form.append("photo", photo)
      form.append("delivery_description", deliveryDescription.trim())
      return apiClient<import("@/types").PromotionOrderFulfillment>(
        `/provider/promotion-orders/${orderId}/fulfillment/delivery`,
        {
          method: "POST",
          body: form,
        },
      )
    },
  },
}
