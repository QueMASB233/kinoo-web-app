"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  ChevronLeft,
  ChevronRight,
  Download,
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
  CREDIT_ORDER_STATUS_LABELS,
} from "@/lib/constants"
import type {
  AdminProviderCreditOrder,
  AdminProviderCreditOrderList,
} from "@/types"
import { AdminCsvExportDialog } from "@/components/admin/admin-csv-export-dialog"
import { useAdminUser } from "@/providers/admin-provider"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const LIMIT = 25

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800",
  processing: "bg-blue-50 text-blue-800",
  paid: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
  expired: "bg-gray-100 text-gray-600",
  refunded: "bg-purple-50 text-purple-800",
}

const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "paid", label: "Pagadas (reembolsables)" },
  { value: "pending", label: "Pendiente" },
  { value: "processing", label: "Procesando" },
  { value: "refunded", label: "Reembolsadas" },
  { value: "failed", label: "Fallidas" },
  { value: "expired", label: "Expiradas" },
]

function statusStyle(status: string) {
  return STATUS_STYLES[status] || "bg-gray-100 text-gray-600"
}

function statusLabel(status: string) {
  return CREDIT_ORDER_STATUS_LABELS[status] || status
}

export default function AdminAdCreditsPage() {
  const readOnly = useAdminUser().role_code === "operator"
  const [result, setResult] = useState<AdminProviderCreditOrderList | null>(
    null,
  )
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [exportOpen, setExportOpen] = useState(false)

  const [refundTarget, setRefundTarget] =
    useState<AdminProviderCreditOrder | null>(null)
  const [refundLoading, setRefundLoading] = useState(false)
  const [refundError, setRefundError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await adminApi.adCredits.listOrders({
        limit: LIMIT,
        offset: (page - 1) * LIMIT,
        status: statusFilter || undefined,
        search: searchQuery || undefined,
      })
      setResult(data)
    } catch {
      setError("Error al cargar las órdenes de créditos publicitarios")
    } finally {
      setIsLoading(false)
    }
  }, [page, statusFilter, searchQuery])

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
    setStatusFilter("")
    setPage(1)
  }

  async function confirmRefund() {
    if (!refundTarget) return
    setRefundLoading(true)
    setRefundError(null)
    try {
      const res = await adminApi.adCredits.refundOrder(refundTarget.id)
      setRefundTarget(null)
      setSuccessMessage(res.message || "Reembolso procesado correctamente")
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

  const totalPages = result ? Math.ceil(result.total / LIMIT) : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-[#111827]">
            Créditos publicitarios
          </h1>
          {result && (
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
              {result.total} orden{result.total !== 1 && "es"}
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
        Compras de paquetes de créditos vía Nuvei. Solo las órdenes{" "}
        <strong>pagadas</strong> pueden reembolsarse (reversión en Nuvei y en el
        saldo del proveedor).
      </p>

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

      <div className={ADMIN_FILTER_PANEL_CLASS}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1 max-w-md space-y-1">
            <label className={ADMIN_FILTER_LABEL_CLASS}>Buscar</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Proveedor, email, pack o ID Nuvei…"
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
          No hay órdenes que coincidan con los filtros.
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3">Proveedor</th>
                  <th className="px-4 py-3">Paquete</th>
                  <th className="px-4 py-3">Monto</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Nuvei TX</th>
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {result.items.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {order.provider_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {order.provider_email}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{order.pack_id}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">
                        ${Number(order.amount_usd).toFixed(2)}
                      </span>
                      <span className="text-gray-400 text-xs block">
                        {Number(order.credits_to_grant)} créditos
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${statusStyle(order.status)}`}
                      >
                        {statusLabel(order.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600 max-w-[140px] truncate">
                      {order.nuvei_transaction_id || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {format(new Date(order.created_at), "dd MMM yyyy HH:mm", {
                        locale: es,
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!readOnly && order.status === "paid" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-amber-800 border-amber-200 hover:bg-amber-50"
                          onClick={() => {
                            setRefundError(null)
                            setRefundTarget(order)
                          }}
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
            {result.items.map((order) => (
              <div
                key={order.id}
                className="rounded-lg border border-gray-200 bg-white p-4 space-y-2"
              >
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-medium text-gray-900">
                      {order.provider_name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {order.provider_email}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${statusStyle(order.status)}`}
                  >
                    {statusLabel(order.status)}
                  </span>
                </div>
                <p className="text-sm text-gray-700">
                  {order.pack_id} · ${Number(order.amount_usd).toFixed(2)} ·{" "}
                  {Number(order.credits_to_grant)} créditos
                </p>
                {order.nuvei_transaction_id && (
                  <p className="font-mono text-xs text-gray-500 break-all">
                    {order.nuvei_transaction_id}
                  </p>
                )}
                <p className="text-xs text-gray-400">
                  {format(new Date(order.created_at), "dd MMM yyyy HH:mm", {
                    locale: es,
                  })}
                </p>
                {!readOnly && order.status === "paid" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setRefundError(null)
                      setRefundTarget(order)
                    }}
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

      <AdminCsvExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        title="Exportar transacciones"
        description="Selecciona los filtros y descarga un archivo CSV con las órdenes de compra de créditos publicitarios."
        statusOptions={STATUS_FILTER_OPTIONS}
        dateFromLabel="Fecha desde"
        dateToLabel="Fecha hasta"
        downloadFilenamePrefix="transacciones_admin"
        onDownload={(filters) =>
          adminApi.adCredits.exportOrdersCsv({
            status: filters.status || undefined,
            provider_id: filters.providerId || undefined,
            date_from: filters.dateFrom || undefined,
            date_to: filters.dateTo || undefined,
          })
        }
      />

      <Dialog
        open={!!refundTarget}
        onOpenChange={(open) => !open && !refundLoading && setRefundTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar reembolso</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground pt-1">
                <p>
                  Se reembolsará en <strong>Nuvei</strong> y se revertirán{" "}
                  <strong>
                    {refundTarget
                      ? Number(refundTarget.credits_to_grant)
                      : 0}{" "}
                    créditos
                  </strong>{" "}
                  del proveedor{" "}
                  <strong>{refundTarget?.provider_name}</strong>.
                </p>
                <p>
                  Monto: $
                  {refundTarget
                    ? Number(refundTarget.amount_usd).toFixed(2)
                    : "0.00"}{" "}
                  USD
                </p>
                {refundTarget?.nuvei_transaction_id && (
                  <p className="font-mono text-xs break-all">
                    TX: {refundTarget.nuvei_transaction_id}
                  </p>
                )}
                <p className="text-amber-700 text-xs">
                  El proveedor debe tener saldo suficiente (no haber gastado
                  esos créditos).
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          {refundError && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
              {refundError}
            </p>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              disabled={refundLoading}
              onClick={() => setRefundTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={refundLoading}
              onClick={confirmRefund}
            >
              {refundLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Reembolsar en Nuvei"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
