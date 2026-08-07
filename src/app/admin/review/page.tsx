"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { adminApi } from "@/lib/admin-api"
import { ApiError } from "@/lib/api-client"
import { BENEFIT_TYPE_LABELS, PROMOTION_TYPE_LABELS } from "@/lib/constants"
import { useAdminBadges } from "@/providers/admin-provider"
import { AdminReviewLocationsMap } from "@/components/admin/admin-review-locations-map"
import {
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  ImageIcon,
  Search,
  RotateCcw,
  MapPin,
} from "lucide-react"
import type { Promotion, PromotionLocation } from "@/types"

export default function ReviewPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    setIsLoading(true)
    adminApi.promotionReview
      .listPending(searchQuery ? { search: searchQuery } : undefined)
      .then(setPromotions)
      .catch(() => setError("Error al cargar las promociones pendientes"))
      .finally(() => setIsLoading(false))
  }, [searchQuery])

  function handleSearch() {
    setSearchQuery(searchInput)
  }

  function handleReset() {
    setSearchInput("")
    setSearchQuery("")
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-[#111827]">
          Revisión de promociones
        </h1>
        {!isLoading && promotions.length > 0 && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
            {promotions.length} pendiente{promotions.length !== 1 && "s"}
          </span>
        )}
      </div>

      <div className="rounded-lg border border-[#e5e7eb] bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Buscar</label>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Título, negocio, cupón, email..."
              className="h-9 w-64 rounded-lg border border-gray-300 px-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <button
            onClick={handleSearch}
            className="flex h-9 items-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            Buscar
          </button>
          <button
            onClick={handleReset}
            className="flex h-9 items-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Limpiar
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : promotions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckCircle className="h-12 w-12 text-green-400" />
          <p className="mt-4 text-sm font-medium text-gray-600">
            No hay promociones pendientes de revisión
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {promotions.map((promo) => (
            <ReviewCard
              key={promo.id}
              promo={promo}
              onRemove={() =>
                setPromotions((prev) =>
                  prev.filter((p) => p.id !== promo.id),
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ReviewCard({
  promo,
  onRemove,
}: {
  promo: Promotion
  onRemove: () => void
}) {
  const { notifyPendingReviewProcessed } = useAdminBadges()
  const [processing, setProcessing] = useState<"approve" | "reject" | null>(
    null,
  )
  const [showRejectField, setShowRejectField] = useState(false)
  const [reason, setReason] = useState("")
  const [cardError, setCardError] = useState<string | null>(null)
  const [mapOpen, setMapOpen] = useState(false)

  const locations: PromotionLocation[] = promo.locations ?? []
  const locationCount = locations.length
  const hasLocations = locationCount > 0

  async function handleApprove() {
    setProcessing("approve")
    setCardError(null)
    try {
      await adminApi.promotionReview.review(promo.id, { action: "approve" })
      notifyPendingReviewProcessed()
      onRemove()
    } catch (err) {
      setCardError(
        err instanceof ApiError ? err.message : "Error al aprobar",
      )
    } finally {
      setProcessing(null)
    }
  }

  async function handleReject() {
    setProcessing("reject")
    setCardError(null)
    try {
      await adminApi.promotionReview.review(promo.id, {
        action: "reject",
        reason: reason.trim() || undefined,
      })
      notifyPendingReviewProcessed()
      onRemove()
    } catch (err) {
      setCardError(
        err instanceof ApiError ? err.message : "Error al rechazar",
      )
    } finally {
      setProcessing(null)
    }
  }

  const fmt = (d: string) =>
    format(new Date(d), "dd MMM yyyy", { locale: es })

  return (
    <div className="rounded-lg border border-[#e5e7eb] bg-white">
      <div className="flex flex-col lg:flex-row">
        <div className="flex-1 p-5 space-y-3">
          <div className="flex items-start gap-4">
            {promo.image_url ? (
              <img
                src={promo.image_url}
                alt=""
                className="h-20 w-20 shrink-0 rounded-lg border border-gray-200 object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
                <ImageIcon className="h-8 w-8 text-gray-300" />
              </div>
            )}

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    promo.type === "service"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-blue-50 text-blue-700"
                  }`}
                >
                  {PROMOTION_TYPE_LABELS[promo.type] || promo.type}
                </span>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {BENEFIT_TYPE_LABELS[promo.benefit_type] ||
                    promo.benefit_type}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-[#111827]">
                {promo.title}
              </h3>
              {promo.description && (
                <p className="text-sm text-[#6b7280]">
                  {promo.description.length > 200
                    ? `${promo.description.slice(0, 200)}...`
                    : promo.description}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-xs">
            <Detail label="Proveedor" value={promo.provider_id?.slice(0, 8) || "—"} />
            {promo.business_name && (
              <Detail label="Negocio" value={promo.business_name} />
            )}
            {promo.business_address && (
              <Detail label="Dirección" value={promo.business_address} />
            )}
            {promo.business_phone && (
              <Detail label="Teléfono" value={promo.business_phone} />
            )}
            {promo.service_price != null && (
              <Detail
                label="Precio servicio"
                value={`$${promo.service_price.toFixed(2)}`}
              />
            )}
            {promo.coupon_code && (
              <Detail label="Cupón" value={promo.coupon_code} />
            )}
            <Detail
              label="Stock"
              value={
                promo.stock_total != null
                  ? `${promo.stock_remaining ?? 0}/${promo.stock_total}`
                  : "Ilimitado"
              }
            />
            <Detail
              label="Fechas"
              value={`${fmt(promo.start_date)} — ${fmt(promo.end_date)}`}
            />
            <Detail label="Creada" value={fmt(promo.created_at)} />
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-gray-600">
                  {hasLocations
                    ? `${locationCount} ubicación${locationCount !== 1 ? "es" : ""}`
                    : "Ubicaciones"}
                </p>
                {!hasLocations ? (
                  <p className="mt-1 text-xs text-amber-700">
                    Sin ubicaciones — no se mostrará en la app aunque apruebes
                  </p>
                ) : (
                  <ul className="mt-1.5 space-y-1">
                    {locations.map((loc) => (
                      <li
                        key={loc.id}
                        className="flex items-center gap-1.5 text-xs text-gray-700"
                      >
                        <MapPin className="h-3 w-3 shrink-0 text-gray-400" />
                        <span className="truncate">
                          {loc.place.address ||
                            loc.place.city ||
                            "Sin dirección"}
                        </span>
                        <span className="shrink-0 text-[10px] text-gray-400">
                          {loc.coverage_type === "city" ? "25 km" : "1 km"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <MapPin className="h-3.5 w-3.5" />
                Ver en mapa
              </button>
            </div>
          </div>

          {promo.link && (
            <a
              href={promo.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              {promo.link}
            </a>
          )}

          {promo.targeting &&
            Object.keys(promo.targeting).length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer font-medium text-gray-500 hover:text-gray-700">
                  Targeting JSON
                </summary>
                <pre className="mt-1 max-h-32 overflow-auto rounded bg-gray-50 p-2 text-[10px] text-gray-600">
                  {JSON.stringify(promo.targeting, null, 2)}
                </pre>
              </details>
            )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-gray-200 p-5 lg:w-[220px] lg:border-l lg:border-t-0">
          <button
            onClick={handleApprove}
            disabled={processing !== null}
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {processing === "approve" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Aprobar
          </button>

          {!hasLocations && (
            <p className="text-[11px] leading-snug text-amber-700">
              Sin ubicaciones: aunque apruebes, no aparecerá en la app.
            </p>
          )}

          {!showRejectField ? (
            <button
              onClick={() => setShowRejectField(true)}
              disabled={processing !== null}
              className="flex h-10 items-center justify-center gap-2 rounded-lg border border-red-300 px-4 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              Rechazar
            </button>
          ) : (
            <div className="space-y-2">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 1000))}
                placeholder="Razón del rechazo (opcional)"
                rows={3}
                className="w-full rounded-lg border border-gray-300 p-2 text-xs text-gray-700 placeholder:text-gray-400 focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400"
              />
              <button
                onClick={handleReject}
                disabled={processing !== null}
                className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-red-600 text-xs font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {processing === "reject" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                Confirmar rechazo
              </button>
              <button
                onClick={() => {
                  setShowRejectField(false)
                  setReason("")
                }}
                className="w-full text-xs text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {cardError && (
        <div className="border-t border-red-200 bg-red-50 px-5 py-3">
          <p className="text-xs text-red-600">{cardError}</p>
        </div>
      )}

      <AdminReviewLocationsMap
        open={mapOpen}
        onOpenChange={setMapOpen}
        title={promo.title}
        locations={locations}
      />
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-medium text-gray-500">{label}: </span>
      <span className="text-gray-700">{value}</span>
    </div>
  )
}
