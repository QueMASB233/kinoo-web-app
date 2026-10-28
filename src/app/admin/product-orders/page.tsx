"use client"

import { Fragment, useCallback, useEffect, useState, type FormEvent } from "react"
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
import { useAdminUser } from "@/providers/admin-provider"
import { CheckoutSnapshotView } from "@/components/admin/checkout-snapshot-view"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  ADMIN_FILTER_INPUT_CLASS,
  ADMIN_FILTER_LABEL_CLASS,
  ADMIN_FILTER_PANEL_CLASS,
  ADMIN_FILTER_SELECT_CLASS,
} from "@/lib/constants"
import type {
  AdminProductOrderListItem,
  ProductShippingStatus,
} from "@/types"

const LIMIT = 25

const SHIPPING_LABELS: Record<string, string> = {
  pending: "Pendiente",
  shipped: "Enviado",
  delivered: "Entregado",
}

const STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700",
  refunded: "bg-purple-50 text-purple-800",
  failed: "bg-red-50 text-red-700",
  pending: "bg-amber-50 text-amber-800",
  processing: "bg-blue-50 text-blue-800",
}

function formatUsd(value: number | string) {
  return Number(value).toLocaleString("es-EC", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  })
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return format(new Date(value), "dd MMM yyyy, HH:mm", { locale: es })
}

function nextShipping(
  status: ProductShippingStatus | null | undefined,
): ProductShippingStatus | null {
  if (!status || status === "pending") return "shipped"
  if (status === "shipped") return "delivered"
  return null
}

export default function AdminProductOrdersPage() {
  const { toast } = useToast()
  const readOnly = useAdminUser().role_code === "operator"

  const [items, setItems] = useState<AdminProductOrderListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState("paid")
  const [shippingFilter, setShippingFilter] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [appliedSearch, setAppliedSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [refundTarget, setRefundTarget] = useState<AdminProductOrderListItem | null>(
    null,
  )
  const [refundReason, setRefundReason] = useState("")
  const [refunding, setRefunding] = useState(false)

  const fetchOrders = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await adminApi.productOrders.list({
        limit: LIMIT,
        offset: (page - 1) * LIMIT,
        status: statusFilter || undefined,
        shipping_status: shippingFilter || undefined,
        search: appliedSearch || undefined,
      })
      setItems(res.items)
      setTotal(res.total)
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar las órdenes de producto.",
      })
    } finally {
      setIsLoading(false)
    }
  }, [page, statusFilter, shippingFilter, appliedSearch, toast])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  function handleSearchSubmit(e?: FormEvent) {
    e?.preventDefault()
    setAppliedSearch(searchInput.trim())
    setPage(1)
  }

  async function advanceShipping(item: AdminProductOrderListItem) {
    const next = nextShipping(item.shipping_status)
    if (!next || readOnly) return
    setBusyId(item.id)
    try {
      await adminApi.productOrders.updateShipping(item.id, next)
      toast({
        title: "Envío actualizado",
        description: SHIPPING_LABELS[next] || next,
      })
      await fetchOrders()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err instanceof ApiError
            ? err.message
            : "No se pudo actualizar el envío.",
      })
    } finally {
      setBusyId(null)
    }
  }

  async function confirmRefund() {
    if (!refundTarget || !refundReason.trim()) return
    setRefunding(true)
    try {
      const res = await adminApi.productOrders.refund(refundTarget.id, {
        reason: refundReason.trim(),
      })
      toast({
        title: "Reembolso procesado",
        description: res.stock_restored
          ? `${res.message} Stock restaurado.`
          : res.message,
      })
      setRefundTarget(null)
      setRefundReason("")
      await fetchOrders()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error al reembolsar",
        description:
          err instanceof ApiError ? err.message : "No se pudo procesar el reembolso.",
      })
    } finally {
      setRefunding(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Órdenes de producto</h1>
        <p className="text-sm text-muted-foreground">
          Envíos de productos (proveedor y Kynoo).
          {readOnly ? " Solo lectura." : " Admin puede actualizar envío y reembolsar."}
        </p>
      </div>

      <div className={ADMIN_FILTER_PANEL_CLASS}>
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col gap-3 lg:flex-row lg:items-end"
        >
          <div className="flex-1 space-y-1">
            <label className={ADMIN_FILTER_LABEL_CLASS}>Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className={`${ADMIN_FILTER_INPUT_CLASS} pl-9`}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Cliente, producto, proveedor, TX…"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className={ADMIN_FILTER_LABEL_CLASS}>Pago</label>
            <select
              className={ADMIN_FILTER_SELECT_CLASS}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="paid">Pagadas</option>
              <option value="">Todos</option>
              <option value="refunded">Reembolsadas</option>
              <option value="failed">Fallidas</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className={ADMIN_FILTER_LABEL_CLASS}>Envío</label>
            <select
              className={ADMIN_FILTER_SELECT_CLASS}
              value={shippingFilter}
              onChange={(e) => {
                setShippingFilter(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Todos</option>
              <option value="pending">Pendiente</option>
              <option value="shipped">Enviado</option>
              <option value="delivered">Entregado</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm">
              Buscar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setSearchInput("")
                setAppliedSearch("")
                setStatusFilter("paid")
                setShippingFilter("")
                setPage(1)
              }}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Producto</th>
              <th className="px-3 py-2 font-medium">Cliente</th>
              <th className="px-3 py-2 font-medium">Proveedor</th>
              <th className="px-3 py-2 font-medium">Pago</th>
              <th className="px-3 py-2 font-medium">Envío</th>
              <th className="px-3 py-2 font-medium">Monto</th>
              <th className="px-3 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  Sin órdenes
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const ship = item.shipping_status || "pending"
                const next = item.status === "paid" ? nextShipping(ship) : null
                const open = expandedId === item.id
                return (
                  <Fragment key={item.id}>
                    <tr className="border-t border-border/60">
                      <td className="px-3 py-3">
                        <p className="font-medium">{item.product_title_snapshot}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.id.slice(0, 8)}…
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <p>{item.buyer_full_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.buyer_email || "—"}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <p>{item.provider_name || "Kynoo"}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.provider_email || "—"}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_STYLES[item.status] || "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {item.status}
                        </span>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(item.paid_at)}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {SHIPPING_LABELS[ship] || ship}
                      </td>
                      <td className="px-3 py-3">{formatUsd(item.amount_usd)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setExpandedId(open ? null : item.id)
                            }
                          >
                            {open ? "Ocultar" : "Detalle"}
                          </Button>
                          {!readOnly && next ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busyId === item.id}
                              onClick={() => advanceShipping(item)}
                            >
                              {busyId === item.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : next === "shipped" ? (
                                "Enviar"
                              ) : (
                                "Entregar"
                              )}
                            </Button>
                          ) : null}
                          {!readOnly && item.refundable ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setRefundTarget(item)
                                setRefundReason("")
                              }}
                            >
                              <Undo2 className="mr-1 h-3.5 w-3.5" />
                              Refund
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {open ? (
                      <tr className="border-t border-border/40 bg-muted/10">
                        <td colSpan={7} className="px-3 py-3">
                          <CheckoutSnapshotView snapshot={item.checkout_snapshot} />
                          <p className="mt-2 text-xs text-muted-foreground">
                            TX: {item.nuvei_transaction_id || "—"} · Enviado:{" "}
                            {formatDate(item.shipped_at)} · Entregado:{" "}
                            {formatDate(item.delivered_at)}
                          </p>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {total > LIMIT ? (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {total} órdenes · página {page}/{totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={!!refundTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRefundTarget(null)
            setRefundReason("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reembolsar orden</DialogTitle>
            <DialogDescription>
              {refundTarget
                ? `${refundTarget.product_title_snapshot} · ${formatUsd(
                    refundTarget.amount_usd,
                  )} · ${refundTarget.buyer_full_name || refundTarget.buyer_email}`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Motivo del reembolso (obligatorio)"
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRefundTarget(null)}
              disabled={refunding}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={refunding || !refundReason.trim()}
              onClick={confirmRefund}
            >
              {refunding ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirmar reembolso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
