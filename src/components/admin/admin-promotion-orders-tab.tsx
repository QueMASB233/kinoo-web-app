"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  Search,
  Undo2,
} from "lucide-react"
import { adminApi } from "@/lib/admin-api"
import { ApiError } from "@/lib/api-client"
import {
  ADMIN_FILTER_INPUT_CLASS,
  ADMIN_FILTER_LABEL_CLASS,
  ADMIN_FILTER_PANEL_CLASS,
  ADMIN_FILTER_SELECT_CLASS,
  FULFILLMENT_PHASE_LABELS,
  PROMOTION_PAID_ORDER_STATUS_LABELS,
} from "@/lib/constants"
import type { AdminPromotionPaidOrderListItem } from "@/types"
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
import { Textarea } from "@/components/ui/textarea"

const LIMIT = 25

const ORDER_STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700",
  refunded: "bg-purple-50 text-purple-800",
  failed: "bg-red-50 text-red-700",
  cancelled: "bg-gray-100 text-gray-600",
  pending: "bg-amber-50 text-amber-800",
  processing: "bg-blue-50 text-blue-800",
  expired: "bg-gray-100 text-gray-600",
}

const STATUS_FILTER_OPTIONS = [
  { value: "paid", label: "Pagadas (reembolsables)" },
  { value: "", label: "Todos los estados" },
  { value: "refunded", label: "Reembolsadas" },
  { value: "failed", label: "Fallidas" },
  { value: "cancelled", label: "Canceladas" },
  { value: "pending", label: "Pendiente de pago" },
  { value: "processing", label: "Procesando" },
  { value: "expired", label: "Expiradas" },
]

const PHASE_FILTER_OPTIONS = [
  { value: "", label: "Todas las fases" },
  { value: "pending_contact", label: "Pendiente de contactar" },
  { value: "scheduled", label: "Agendado" },
  { value: "submitted", label: "En revisión" },
  { value: "verified", label: "Verificado" },
  { value: "rejected", label: "Rechazado" },
  { value: "refunded", label: "Reembolsada" },
]

type RefundTarget = {
  orderId: string
  amountUsd: string | number
  buyerName: string
  buyerEmail: string
  promotionTitle: string
  nuveiTxId?: string | null
  fulfillmentStatus?: string | null
  fulfillmentPhase?: string | null
  requiresForce: boolean
}

function orderStatusStyle(status: string) {
  return ORDER_STATUS_STYLES[status] || "bg-gray-100 text-gray-600"
}

function orderStatusLabel(status: string) {
  return PROMOTION_PAID_ORDER_STATUS_LABELS[status] || status
}

function phaseLabel(phase: string | null | undefined) {
  if (!phase) return "—"
  return FULFILLMENT_PHASE_LABELS[phase] || phase
}

interface AdminPromotionOrdersTabProps {
  onRefundSuccess?: (message: string) => void
}

export function AdminPromotionOrdersTab({
  onRefundSuccess,
}: AdminPromotionOrdersTabProps) {
  const [items, setItems] = useState<AdminPromotionPaidOrderListItem[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState("paid")
  const [phaseFilter, setPhaseFilter] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  const [refundTarget, setRefundTarget] = useState<RefundTarget | null>(null)
  const [refundReason, setRefundReason] = useState("")
  const [refundForce, setRefundForce] = useState(false)
  const [refundLoading, setRefundLoading] = useState(false)
  const [refundError, setRefundError] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await adminApi.promotionOrders.list({
        limit: LIMIT,
        offset: (page - 1) * LIMIT,
        status: statusFilter || undefined,
        fulfillment_phase: phaseFilter || undefined,
        search: searchQuery || undefined,
      })
      setItems(data.items)
      setTotal(data.total)
    } catch {
      setError("Error al cargar las órdenes de pago")
    } finally {
      setIsLoading(false)
    }
  }, [page, statusFilter, phaseFilter, searchQuery])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  function handleSearch() {
    setSearchQuery(searchInput)
    setPage(1)
  }

  function handleReset() {
    setSearchInput("")
    setSearchQuery("")
    setStatusFilter("paid")
    setPhaseFilter("")
    setPage(1)
  }

  function openRefund(item: AdminPromotionPaidOrderListItem) {
    setRefundTarget({
      orderId: item.id,
      amountUsd: item.amount_usd,
      buyerName: item.buyer_full_name,
      buyerEmail: item.buyer_email,
      promotionTitle: item.promotion_title_snapshot,
      nuveiTxId: item.nuvei_transaction_id,
      fulfillmentStatus: item.fulfillment_status,
      fulfillmentPhase: item.fulfillment_phase,
      requiresForce: item.requires_force,
    })
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
      onRefundSuccess?.(res.message || "Reembolso procesado correctamente")
      await fetchOrders()
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

  const totalPages = Math.ceil(total / LIMIT) || 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-base font-semibold text-[#111827]">
          Órdenes de pago
        </h2>
        {total > 0 && (
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
            {total} registro{total !== 1 && "s"}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-500 max-w-2xl">
        Todas las reservas con intento o pago Nuvei, incluidas las que el
        proveedor aún no ha contactado. Desde aquí puedes reembolsar sin
        depender de una entrega registrada.
      </p>

      <div className={ADMIN_FILTER_PANEL_CLASS}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1 max-w-md space-y-1">
            <label className={ADMIN_FILTER_LABEL_CLASS}>Buscar</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Cliente, proveedor, servicio, TX o UUID…"
                className={`${ADMIN_FILTER_INPUT_CLASS} pl-9`}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className={ADMIN_FILTER_LABEL_CLASS}>Estado de pago</label>
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
            <label className={ADMIN_FILTER_LABEL_CLASS}>Fase de entrega</label>
            <select
              value={phaseFilter}
              onChange={(e) => {
                setPhaseFilter(e.target.value)
                setPage(1)
              }}
              className={ADMIN_FILTER_SELECT_CLASS}
            >
              {PHASE_FILTER_OPTIONS.map((o) => (
                <option key={o.value || "all-phases"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
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
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
          No hay órdenes que coincidan con los filtros.
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
                  <th className="px-4 py-3">Pago</th>
                  <th className="px-4 py-3">Entrega</th>
                  <th className="px-4 py-3">Creada</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 max-w-[200px] truncate">
                        {item.promotion_title_snapshot}
                      </div>
                      {item.nuvei_transaction_id && (
                        <div className="text-[11px] font-mono text-gray-400 truncate max-w-[180px]">
                          {item.nuvei_transaction_id}
                        </div>
                      )}
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
                        className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${orderStatusStyle(item.status)}`}
                      >
                        {orderStatusLabel(item.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {phaseLabel(item.fulfillment_phase)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {format(new Date(item.created_at), "dd MMM yyyy HH:mm", {
                        locale: es,
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.refundable ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-purple-700 border-purple-200 hover:bg-purple-50"
                          onClick={() => openRefund(item)}
                        >
                          <Undo2 className="h-3.5 w-3.5 mr-1" />
                          Reembolsar
                        </Button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-gray-200 bg-white p-4 space-y-2"
              >
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-medium text-gray-900">
                      {item.promotion_title_snapshot}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.provider_business_name || item.provider_name}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 h-fit rounded px-2 py-0.5 text-xs font-medium ${orderStatusStyle(item.status)}`}
                  >
                    {orderStatusLabel(item.status)}
                  </span>
                </div>
                <p className="text-sm text-gray-700">
                  {item.buyer_full_name} · ${Number(item.amount_usd).toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">
                  Entrega: {phaseLabel(item.fulfillment_phase)}
                </p>
                {item.refundable && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-purple-700 border-purple-200"
                    onClick={() => openRefund(item)}
                  >
                    <Undo2 className="h-3.5 w-3.5 mr-1" />
                    Reembolsar
                  </Button>
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>
                Página {page} de {totalPages} · {total} orden
                {total !== 1 && "es"}
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
                      a{" "}
                      <strong className="text-foreground">
                        {refundTarget.buyerName}
                      </strong>{" "}
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
                    <p className="text-xs">
                      Fase entrega:{" "}
                      <strong>
                        {phaseLabel(
                          refundTarget.fulfillmentPhase ||
                            refundTarget.fulfillmentStatus,
                        )}
                      </strong>
                    </p>
                    <div className="space-y-1.5">
                      <label
                        htmlFor="orders-refund-reason"
                        className="text-xs font-medium text-gray-700 block"
                      >
                        Motivo del reembolso (obligatorio)
                      </label>
                      <Textarea
                        id="orders-refund-reason"
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
