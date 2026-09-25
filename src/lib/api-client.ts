import {
  getAccessToken,
  getAccessTokenExpiryMs,
  getRefreshToken,
  setTokens,
  clearTokens,
} from "./auth"
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

/**
 * Refresca el access token si vence pronto. El backend lee el multipart completo
 * antes de validar el token: un 401 tras subir un video obliga a re-subirlo entero.
 */
export async function ensureFreshAccessToken(minValidityMs = 5 * 60_000): Promise<void> {
  const expiresAt = getAccessTokenExpiryMs()
  if (expiresAt == null || expiresAt - Date.now() > minValidityMs) return
  await refreshAccessToken()
}

export interface UploadOptions {
  /** Fracción 0–1 de bytes enviados al servidor. */
  onUploadProgress?: (fraction: number) => void
  signal?: AbortSignal
  timeoutMs?: number
}

function sendMultipartWithProgress(
  endpoint: string,
  method: "POST" | "PUT",
  form: FormData,
  token: string | null,
  options: UploadOptions,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(method, `${API_BASE_URL}${endpoint}`)
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)
    if (options.timeoutMs) xhr.timeout = options.timeoutMs

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        options.onUploadProgress?.(e.loaded / e.total)
      }
    }

    const onAbort = () => xhr.abort()
    options.signal?.addEventListener("abort", onAbort, { once: true })
    const cleanup = () => options.signal?.removeEventListener("abort", onAbort)

    xhr.onload = () => {
      cleanup()
      let body: unknown = {}
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : {}
      } catch {
        body = {}
      }
      resolve({ status: xhr.status, body })
    }
    xhr.ontimeout = () => {
      cleanup()
      reject(
        new ApiError(
          408,
          "La subida tardó demasiado. Revisa tu conexión e inténtalo de nuevo.",
          "Tiempo de espera",
        ),
      )
    }
    xhr.onabort = () => {
      cleanup()
      reject(new ApiError(499, "Subida cancelada.", "Subida cancelada"))
    }
    xhr.onerror = () => {
      cleanup()
      reject(
        new ApiError(
          0,
          "Se perdió la conexión durante la subida. Inténtalo de nuevo.",
          "Error de conexión",
        ),
      )
    }

    if (options.signal?.aborted) {
      xhr.abort()
      return
    }
    xhr.send(form)
  })
}

/** Multipart con progreso de subida (XHR); `fetch` no expone progreso de upload. */
async function apiUploadWithProgress<T>(
  endpoint: string,
  method: "POST" | "PUT",
  form: FormData,
  options: UploadOptions = {},
): Promise<T> {
  await ensureFreshAccessToken()

  let res = await sendMultipartWithProgress(
    endpoint,
    method,
    form,
    getAccessToken(),
    options,
  )

  if (res.status === 401) {
    const newToken = await refreshAccessToken()
    if (!newToken) {
      clearTokens()
      if (typeof window !== "undefined") {
        window.location.href = ROUTES.LOGIN
      }
      throw new ApiError(401, "Sesión expirada")
    }
    options.onUploadProgress?.(0)
    res = await sendMultipartWithProgress(endpoint, method, form, newToken, options)
  }

  if (res.status < 200 || res.status >= 300) {
    const detail = (res.body as { detail?: unknown } | null)?.detail
    const parsed = parseApiErrorDetail(detail)
    throw new ApiError(res.status, parsed.message, parsed.title)
  }

  return res.body as T
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
      uploadOptions?: UploadOptions,
    ) => {
      const form = new FormData()
      form.append("data", JSON.stringify(data))
      if (photo) form.append("photo", photo)
      if (video) form.append("video", video)
      if (videoThumbnail) form.append("video_thumbnail", videoThumbnail)
      if (video) {
        return apiUploadWithProgress<import("@/types").Promotion>(
          "/admin/promotions",
          "POST",
          form,
          { timeoutMs: PROMOTION_VIDEO_UPLOAD_TIMEOUT_MS, ...uploadOptions },
        )
      }
      return apiClient<import("@/types").Promotion>("/admin/promotions", {
        method: "POST",
        body: form,
      })
    },
    update: (
      id: string,
      data: import("@/types").UpdatePromotionRequest,
      photo?: File | null,
      video?: File | null,
      videoThumbnail?: File | null,
      uploadOptions?: UploadOptions,
    ) => {
      const form = new FormData()
      form.append("data", JSON.stringify(data))
      if (photo) form.append("photo", photo)
      if (video) form.append("video", video)
      if (videoThumbnail) form.append("video_thumbnail", videoThumbnail)
      if (video) {
        return apiUploadWithProgress<import("@/types").Promotion>(
          `/admin/promotions/${id}`,
          "PUT",
          form,
          { timeoutMs: PROMOTION_VIDEO_UPLOAD_TIMEOUT_MS, ...uploadOptions },
        )
      }
      return apiClient<import("@/types").Promotion>(`/admin/promotions/${id}`, {
        method: "PUT",
        body: form,
      })
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
