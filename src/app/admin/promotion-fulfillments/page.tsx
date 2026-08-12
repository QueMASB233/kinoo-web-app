"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Loader2,
  RotateCcw,
  Search,
  Undo2,
  XCircle,
} from "lucide-react"
import { AdminCsvExportDialog } from "@/components/admin/admin-csv-export-dialog"
import { AdminPromotionOrdersTab } from "@/components/admin/admin-promotion-orders-tab"
import { adminApi } from "@/lib/admin-api"
import { ApiError } from "@/lib/api-client"
import { useAdminBadges } from "@/providers/admin-provider"
import {
  ADMIN_FILTER_INPUT_CLASS,
  ADMIN_FILTER_LABEL_CLASS,
  ADMIN_FILTER_PANEL_CLASS,
  ADMIN_FILTER_SELECT_CLASS,
  FULFILLMENT_STATUS_LABELS,
  PROMOTION_PAID_ORDER_STATUS_LABELS,
} from "@/lib/constants"
import type {
  AdminPromotionOrderFulfillment,
  AdminPromotionOrderFulfillmentDetail,
  AdminPromotionOrderFulfillmentList,
} from "@/types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

const LIMIT = 25

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-800",
  submitted: "bg-amber-50 text-amber-800",
  verified: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
}

const ORDER_STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700",
  refunded: "bg-purple-50 text-purple-800",
  failed: "bg-red-50 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
}

const STATUS_FILTER_OPTIONS = [
  { value: "submitted", label: "En revisión (pendientes)" },
  { value: "", label: "Todos los estados" },
  { value: "scheduled", label: "Agendadas" },
  { value: "verified", label: "Verificadas" },
  { value: "rejected", label: "Rechazadas" },
]

type RefundTarget = {
  orderId: string
  amountUsd: string | number
  buyerName: string
  buyerEmail: string
  promotionTitle: string
  nuveiTxId?: string | null
  fulfillmentStatus?: string | null
  orderStatus: string
  requiresForce: boolean
}

function statusStyle(status: string) {
  return STATUS_STYLES[status] || "bg-gray-100 text-gray-600"
}

function statusLabel(status: string) {
  return FULFILLMENT_STATUS_LABELS[status] || status
}

function orderStatusStyle(status: string) {
  return ORDER_STATUS_STYLES[status] || "bg-gray-100 text-gray-600"
}

function orderStatusLabel(status: string) {
  return PROMOTION_PAID_ORDER_STATUS_LABELS[status] || status
}

function refundTargetFromFulfillment(
  item: AdminPromotionOrderFulfillment,
): RefundTarget {
  return {
    orderId: item.order_id,
    amountUsd: item.amount_usd,
    buyerName: item.buyer_full_name,
    buyerEmail: item.buyer_email,
    promotionTitle: item.promotion_title_snapshot,
    nuveiTxId: item.nuvei_transaction_id,
    fulfillmentStatus: item.status,
    orderStatus: item.order_status,
    requiresForce: item.status === "verified",
  }
}

export default function AdminPromotionFulfillmentsPage() {
  const { notifyPendingFulfillmentProcessed } = useAdminBadges()
  const [result, setResult] = useState<AdminPromotionOrderFulfillmentList | null>(
    null,
  )
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState("submitted")
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [submittedFrom, setSubmittedFrom] = useState("")
  const [submittedTo, setSubmittedTo] = useState("")

  const [reviewTarget, setReviewTarget] =
    useState<AdminPromotionOrderFulfillment | null>(null)
  const [reviewDetail, setReviewDetail] =
    useState<AdminPromotionOrderFulfillmentDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [adminNotes, setAdminNotes] = useState("")
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [mainTab, setMainTab] = useState<"orders" | "fulfillments">(
    "fulfillments",
  )

  const [refundTarget, setRefundTarget] = useState<RefundTarget | null>(null)
  const [refundReason, setRefundReason] = useState("")
  const [refundForce, setRefundForce] = useState(false)
  const [refundLoading, setRefundLoading] = useState(false)
  const [refundError, setRefundError] = useState<string | null>(null)

  const fetchFulfillments = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await adminApi.promotionFulfillments.list({
        limit: LIMIT,
        offset: (page - 1) * LIMIT,
        status: statusFilter || undefined,
        search: searchQuery || undefined,
        submitted_from: submittedFrom || undefined,
        submitted_to: submittedTo || undefined,
      })
      setResult(data)
    } catch {
      setError("Error al cargar las entregas de servicio")
    } finally {
      setIsLoading(false)
    }
  }, [page, statusFilter, searchQuery, submittedFrom, submittedTo])

  useEffect(() => {
    fetchFulfillments()
  }, [fetchFulfillments])

  function handleSearch() {
    if (submittedFrom && submittedTo && submittedFrom > submittedTo) {
      setError("La fecha inicial no puede ser mayor que la fecha final.")
      return
    }
    setSearchQuery(searchInput)
    setPage(1)
  }

  function handleReset() {
    setSearchInput("")
    setSearchQuery("")
    setSubmittedFrom("")
    setSubmittedTo("")
    setStatusFilter("submitted")
    setPage(1)
  }

  async function openReview(item: AdminPromotionOrderFulfillment) {
    setReviewTarget(item)
    setReviewDetail(null)
    setReviewError(null)
    setAdminNotes("")
    setDetailLoading(true)
    try {
      const detail = await adminApi.promotionFulfillments.get(item.id)
      setReviewDetail(detail)
    } catch {
      setReviewError("No se pudo cargar el detalle de la entrega")
    } finally {
      setDetailLoading(false)
    }
  }

  function closeReview() {
    if (reviewLoading) return
    setReviewTarget(null)
    setReviewDetail(null)
    setReviewError(null)
    setAdminNotes("")
  }

  function openRefund(target: RefundTarget) {
    setRefundTarget(target)
    setRefundReason("")
    setRefundForce(false)
    setRefundError(null)
  }

  function closeRefund() {
    if (refundLoading) return
    setRefundTarget(null)
    setRefundReason("")
    setRefundForce(false)
    setRefundError(null)
  }

  async function confirmRefund() {
    if (!refundTarget) return
    const reason = refundReason.trim()
    if (!reason) {
      setRefundError("El motivo del reembolso es obligatorio.")
      return
    }
    if (refundTarget.requiresForce && !refundForce) {
      setRefundError(
        "Esta entrega ya fue verificada. Marca “Forzar reembolso” para continuar.",
      )
      return
    }

    setRefundLoading(true)
    setRefundError(null)
    try {
      const res = await adminApi.promotionOrders.refund(refundTarget.orderId, {
        reason,
        force: refundTarget.requiresForce ? refundForce : false,
      })
      closeRefund()
      closeReview()
      setSuccessMessage(res.message || "Reembolso procesado correctamente")
      await fetchFulfillments()
    } catch (e) {
      setRefundError(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "No se pudo procesar el reembolso",
      )
    } finally {
      setRefundLoading(false)
    }
  }

  async function submitReview(decision: "verified" | "rejected") {
    if (!reviewTarget) return
    const wasPendingReview = reviewTarget.status === "submitted"
    setReviewLoading(true)
    setReviewError(null)
    try {
      await adminApi.promotionFulfillments.review(reviewTarget.id, {
        status: decision,
        admin_notes: adminNotes.trim() || null,
      })
      if (wasPendingReview) {
        notifyPendingFulfillmentProcessed()
      }
      setSuccessMessage(
        decision === "verified"
          ? "Entrega verificada correctamente"
          : "Entrega rechazada; el proveedor podrá reenviar evidencia",
      )
      closeReview()
      await fetchFulfillments()
    } catch (e) {
      setReviewError(
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "No se pudo guardar la revisión",
      )
    } finally {
      setReviewLoading(false)
    }
  }

  const totalPages = result ? Math.ceil(result.total / LIMIT) : 0
  const detail = reviewDetail || reviewTarget

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#111827]">Servicios</h1>
        <p className="mt-1 text-sm text-gray-500 max-w-2xl">
          Órdenes de pago de reservas y evidencias de entrega enviadas por
          proveedores.
        </p>
      </div>

      {successMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 flex justify-between gap-2">
          <span>{successMessage}</span>
          <button
            type="button"
            className="text-emerald-600 hover:text-emerald-900 shrink-0"
            onClick={() => setSuccessMessage(null)}
          >
            Cerrar
          </button>
        </div>
      )}

      <Tabs
        value={mainTab}
        onValueChange={(v) =>
          setMainTab(v === "orders" ? "orders" : "fulfillments")
        }
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="fulfillments">Entregas de servicio</TabsTrigger>
          <TabsTrigger value="orders">Órdenes de pago</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4 mt-0">
          <AdminPromotionOrdersTab
            onRefundSuccess={(message) => {
              setSuccessMessage(message)
              void fetchFulfillments()
            }}
          />
        </TabsContent>

        <TabsContent value="fulfillments" className="space-y-4 mt-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-[#111827]">
            Entregas de servicio
          </h2>
          {result && (
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
              {result.total} registro{result.total !== 1 && "s"}
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExportOpen(true)}
          className="shrink-0"
        >
          <Download className="h-4 w-4 mr-1" />
          Exportar CSV
        </Button>
      </div>

      <p className="text-sm text-gray-500 max-w-2xl">
        Evidencias enviadas por proveedores tras prestar el servicio reservado.
        Revisa la foto y descripción antes de aprobar o rechazar.
      </p>

      <div className={ADMIN_FILTER_PANEL_CLASS}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1 max-w-md space-y-1">
            <label className={ADMIN_FILTER_LABEL_CLASS}>Buscar</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cliente, proveedor, servicio o ID…"
                className={`${ADMIN_FILTER_INPUT_CLASS} pl-9`}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className={ADMIN_FILTER_LABEL_CLASS}>Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className={ADMIN_FILTER_SELECT_CLASS}
            >
              {STATUS_FILTER_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={ADMIN_FILTER_LABEL_CLASS}>Desde</label>
            <input
              type="date"
              value={submittedFrom}
              onChange={(e) => {
                setSubmittedFrom(e.target.value)
                setPage(1)
              }}
              className={ADMIN_FILTER_INPUT_CLASS}
            />
          </div>
          <div className="space-y-1">
            <label className={ADMIN_FILTER_LABEL_CLASS}>Hasta</label>
            <input
              type="date"
              value={submittedTo}
              onChange={(e) => {
                setSubmittedTo(e.target.value)
                setPage(1)
              }}
              className={ADMIN_FILTER_INPUT_CLASS}
            />
          </div>
          <button
            type="button"
            onClick={handleSearch}
            className="flex h-9 items-center gap-2 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            Buscar
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="flex h-9 items-center gap-2 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Limpiar
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : !result || result.items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
          No hay entregas que coincidan con los filtros.
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Servicio</th>
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Monto</th>
                  <th className="px-4 py-3">Entrega</th>
                  <th className="px-4 py-3">Pago</th>
                  <th className="px-4 py-3">Enviado</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {result.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 max-w-[200px] truncate">
                        {item.promotion_title_snapshot}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {item.provider_business_name || item.provider_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.provider_email}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{item.buyer_full_name}</div>
                      <div className="text-xs text-gray-500">
                        {item.buyer_email}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">
                      ${Number(item.amount_usd).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${statusStyle(item.status)}`}
                      >
                        {statusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${orderStatusStyle(item.order_status)}`}
                      >
                        {orderStatusLabel(item.order_status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {item.submitted_at
                        ? format(
                            new Date(item.submitted_at),
                            "dd MMM yyyy HH:mm",
                            { locale: es },
                          )
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openReview(item)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          {item.status === "submitted" ? "Revisar" : "Ver"}
                        </Button>
                        {item.order_status === "paid" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-purple-700 border-purple-200 hover:bg-purple-50"
                            onClick={() =>
                              openRefund(refundTargetFromFulfillment(item))
                            }
                          >
                            <Undo2 className="h-3.5 w-3.5 mr-1" />
                            Reembolsar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {result.items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-gray-200 bg-white p-4 space-y-2"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-medium text-gray-900">
                      {item.promotion_title_snapshot}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.provider_business_name || item.provider_name}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${statusStyle(item.status)}`}
                    >
                      {statusLabel(item.status)}
                    </span>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${orderStatusStyle(item.order_status)}`}
                    >
                      {orderStatusLabel(item.order_status)}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-700">
                  {item.buyer_full_name} · ${Number(item.amount_usd).toFixed(2)}
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => openReview(item)}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    {item.status === "submitted" ? "Revisar" : "Ver detalle"}
                  </Button>
                  {item.order_status === "paid" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-purple-700 border-purple-200"
                      onClick={() =>
                        openRefund(refundTargetFromFulfillment(item))
                      }
                    >
                      <Undo2 className="h-3.5 w-3.5 mr-1" />
                      Reembolsar
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>
                Página {page} de {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
        </TabsContent>
      </Tabs>

      <AdminCsvExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="Exportar entregas de servicio"
        description="Selecciona proveedor, estado y fechas para descargar el reporte en CSV."
        statusOptions={STATUS_FILTER_OPTIONS}
        dateFromLabel="Desde"
        dateToLabel="Hasta"
        downloadFilenamePrefix="entregas_servicio_admin"
        onDownload={(filters) =>
          adminApi.promotionFulfillments.exportCsv({
            status: filters.status || undefined,
            provider_id: filters.providerId || undefined,
            submitted_from: filters.dateFrom || undefined,
            submitted_to: filters.dateTo || undefined,
          })
        }
      />

      <Dialog
        open={!!reviewTarget}
        onOpenChange={(open) => !open && closeReview()}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detail?.status === "submitted"
                ? "Revisar entrega"
                : "Detalle de entrega"}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground pt-1">
                {detailLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : detail ? (
                  <>
                    <div>
                      <p className="font-medium text-gray-900">
                        {detail.promotion_title_snapshot}
                      </p>
                      <p className="text-xs">
                        ${Number(detail.amount_usd).toFixed(2)} USD ·{" "}
                        {detail.paid_at
                          ? format(new Date(detail.paid_at), "dd MMM yyyy", {
                              locale: es,
                            })
                          : "—"}
                      </p>
                      {detail.nuvei_transaction_id && (
                        <p className="text-xs font-mono text-gray-500 mt-1">
                          TX: {detail.nuvei_transaction_id}
                        </p>
                      )}
                      <p className="text-xs mt-1">
                        Pago:{" "}
                        <span
                          className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium ${orderStatusStyle(detail.order_status)}`}
                        >
                          {orderStatusLabel(detail.order_status)}
                        </span>
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="font-medium text-gray-700">Proveedor</p>
                        <p>
                          {detail.provider_business_name || detail.provider_name}
                        </p>
                        <p className="text-gray-500">{detail.provider_email}</p>
                      </div>
                      <div>
                        <p className="font-medium text-gray-700">Cliente</p>
                        <p>{detail.buyer_full_name}</p>
                        <p className="text-gray-500">{detail.buyer_email}</p>
                        {detail.buyer_phone && (
                          <p className="text-gray-500">{detail.buyer_phone}</p>
                        )}
                      </div>
                    </div>
                    {detail.scheduling_notes && (
                      <div className="rounded bg-gray-50 px-3 py-2 text-xs">
                        <p className="font-medium text-gray-700">
                          Notas de agenda
                        </p>
                        <p>{detail.scheduling_notes}</p>
                      </div>
                    )}
                    {detail.delivery_description && (
                      <div>
                        <p className="font-medium text-gray-700 text-xs mb-1">
                          Descripción del servicio
                        </p>
                        <p className="text-gray-800">{detail.delivery_description}</p>
                      </div>
                    )}
                    {detail.photo_url ? (
                      <div>
                        <p className="font-medium text-gray-700 text-xs mb-2">
                          Foto de evidencia
                        </p>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={detail.photo_url}
                          alt="Evidencia de servicio"
                          className="w-full max-h-64 object-contain rounded-lg border border-gray-200 bg-gray-50"
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700">
                        Sin foto disponible (puede haber expirado la URL firmada).
                      </p>
                    )}
                    {detail.status !== "submitted" && detail.admin_notes && (
                      <div className="rounded bg-red-50 px-3 py-2 text-xs text-red-800">
                        <p className="font-medium">Notas admin</p>
                        <p>{detail.admin_notes}</p>
                      </div>
                    )}
                    {detail.status === "submitted" && (
                      <div>
                        <label
                          htmlFor="admin-notes"
                          className="text-xs font-medium text-gray-700 block mb-1"
                        >
                          Notas para el proveedor (opcional, útil al rechazar)
                        </label>
                        <Textarea
                          id="admin-notes"
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          placeholder="Indica qué debe corregir el proveedor…"
                          rows={3}
                          maxLength={1000}
                        />
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </DialogDescription>
          </DialogHeader>
          {reviewError && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
              {reviewError}
            </p>
          )}
          {detail && !detailLoading && (
            <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between">
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                {detail.order_status === "paid" && (
                  <Button
                    variant="outline"
                    className="text-purple-700 border-purple-200"
                    disabled={reviewLoading}
                    onClick={() => {
                      openRefund(refundTargetFromFulfillment(detail))
                    }}
                  >
                    <Undo2 className="h-4 w-4 mr-1" />
                    Reembolsar
                  </Button>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:ml-auto">
                {detail.status === "submitted" &&
                detail.order_status === "paid" ? (
                  <>
                    <Button
                      variant="outline"
                      disabled={reviewLoading}
                      onClick={closeReview}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={reviewLoading}
                      onClick={() => submitReview("rejected")}
                    >
                      {reviewLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 mr-1" />
                          Rechazar
                        </>
                      )}
                    </Button>
                    <Button
                      disabled={reviewLoading}
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => submitReview("verified")}
                    >
                      {reviewLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Aprobar
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <Button variant="outline" onClick={closeReview}>
                    Cerrar
                  </Button>
                )}
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!refundTarget}
        onOpenChange={(open) => !open && closeRefund()}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reembolsar reserva</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground pt-1">
                {refundTarget ? (
                  <>
                    <p>
                      Se devolverá{" "}
                      <strong className="text-foreground">
                        ${Number(refundTarget.amountUsd).toFixed(2)} USD
                      </strong>{" "}
                      a <strong className="text-foreground">{refundTarget.buyerName}</strong>{" "}
                      ({refundTarget.buyerEmail}) por{" "}
                      <strong className="text-foreground">
                        {refundTarget.promotionTitle}
                      </strong>
                      .
                    </p>
                    {refundTarget.nuveiTxId && (
                      <p className="text-xs font-mono bg-gray-50 rounded px-2 py-1.5">
                        TX: {refundTarget.nuveiTxId}
                      </p>
                    )}
                    {refundTarget.fulfillmentStatus && (
                      <p className="text-xs">
                        Fase entrega:{" "}
                        <strong>{statusLabel(refundTarget.fulfillmentStatus)}</strong>
                      </p>
                    )}
                    {!refundTarget.fulfillmentStatus && (
                      <p className="text-xs text-amber-700">
                        Esta reserva aún no tiene fila de entrega (pendiente de
                        contactar).
                      </p>
                    )}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="refund-reason"
                        className="text-xs font-medium text-gray-700 block"
                      >
                        Motivo del reembolso (obligatorio)
                      </label>
                      <Textarea
                        id="refund-reason"
                        value={refundReason}
                        onChange={(e) => setRefundReason(e.target.value)}
                        placeholder="Ej. El proveedor no pudo prestar el servicio…"
                        rows={3}
                        maxLength={500}
                        disabled={refundLoading}
                      />
                    </div>
                    {refundTarget.requiresForce && (
                      <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 cursor-pointer">
                        <Checkbox
                          checked={refundForce}
                          onCheckedChange={(v) => setRefundForce(v === true)}
                          disabled={refundLoading}
                          className="mt-0.5"
                        />
                        <span>
                          <strong>Forzar reembolso:</strong> la entrega ya fue
                          verificada. Confirma que quieres reembolsar de todos
                          modos.
                        </span>
                      </label>
                    )}
                  </>
                ) : null}
              </div>
            </DialogDescription>
          </DialogHeader>
          {refundError && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
              {refundError}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={refundLoading}
              onClick={closeRefund}
            >
              Cancelar
            </Button>
            <Button
              disabled={refundLoading}
              className="bg-purple-700 hover:bg-purple-800"
              onClick={confirmRefund}
            >
              {refundLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Undo2 className="h-4 w-4 mr-1" />
                  Confirmar reembolso
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
