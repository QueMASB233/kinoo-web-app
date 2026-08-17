"use client"

import { useEffect, useState, useCallback } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { adminApi } from "@/lib/admin-api"
import {
  Loader2,
  ChevronLeft,
  ChevronRight,
  Phone,
  Search,
  RotateCcw,
  CheckCircle2,
  Undo2,
} from "lucide-react"
import type { PaginatedActiveCredits } from "@/types"
import { AdminEmergencyOrdersTab } from "@/components/admin/admin-emergency-orders-tab"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const LIMIT = 25

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700",
  calling: "bg-amber-50 text-amber-800",
  inactive: "bg-gray-100 text-gray-600",
}

const STATUS_LABELS: Record<string, string> = {
  active: "Listo para llamar",
  calling: "En atención",
  inactive: "Cerrado",
}

const CLOSE_REASON_LABELS: Record<string, string> = {
  attended: "Atendida",
  not_reached: "No contactado",
  manual: "Manual",
}

function statusStyle(status: string) {
  return STATUS_STYLES[status] || "bg-gray-100 text-gray-600"
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] || status
}

function formatDt(value: string | null | undefined) {
  if (!value) return "—"
  return format(new Date(value), "dd MMM yyyy HH:mm", { locale: es })
}

/** Motivo de cierre solo aplica a créditos cerrados (inactive). */
function formatCloseCell(credit: {
  status: string
  close_reason?: string | null
  deactivated_at?: string | null
}) {
  if (credit.status !== "inactive") return "—"
  if (credit.close_reason) {
    return (
      CLOSE_REASON_LABELS[credit.close_reason] || credit.close_reason
    )
  }
  return formatDt(credit.deactivated_at)
}

export default function EmergencyCreditsPage() {
  const [result, setResult] = useState<PaginatedActiveCredits | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [mainTab, setMainTab] = useState<"credits" | "orders">("credits")
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const fetchCredits = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const sortBy =
        statusFilter === "calling" ? "call_initiated_at" : "deactivated_at"
      const data = await adminApi.credits({
        page,
        limit: LIMIT,
        status: statusFilter || undefined,
        search: searchQuery || undefined,
        sort_by: sortBy,
        sort_order: "desc",
      })
      setResult(data)
    } catch {
      setError("Error al cargar los créditos de emergencia")
    } finally {
      setIsLoading(false)
    }
  }, [page, statusFilter, searchQuery])

  useEffect(() => {
    fetchCredits()
  }, [fetchCredits])

  function handleStatusChange(value: string) {
    setStatusFilter(value)
    setPage(1)
  }

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

  async function handleCloseAttended(creditId: string) {
    if (
      !window.confirm(
        "¿Confirmas que la emergencia fue atendida? El crédito quedará consumido.",
      )
    ) {
      return
    }
    setActionLoadingId(creditId)
    try {
      await adminApi.closeEmergencyCreditAttended(creditId)
      await fetchCredits()
    } catch {
      setError("No se pudo cerrar el caso")
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleRelease(creditId: string) {
    if (
      !window.confirm(
        "¿No hubo contacto? El crédito volverá a estar activo para el usuario.",
      )
    ) {
      return
    }
    setActionLoadingId(creditId)
    try {
      await adminApi.releaseEmergencyCreditCall(creditId)
      await fetchCredits()
    } catch {
      setError("No se pudo liberar el crédito")
    } finally {
      setActionLoadingId(null)
    }
  }

  const totalPages = result ? Math.ceil(result.total / LIMIT) : 0

  return (
    <div className="space-y-6">
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
          setMainTab(v === "orders" ? "orders" : "credits")
        }
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="credits">Créditos de emergencia</TabsTrigger>
          <TabsTrigger value="orders">Órdenes de pago</TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4 mt-0">
          <AdminEmergencyOrdersTab
            onRefundSuccess={(message) => {
              setSuccessMessage(message)
              void fetchCredits()
            }}
          />
        </TabsContent>

        <TabsContent value="credits" className="space-y-6 mt-0">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-[#111827]">
          Créditos de emergencia
        </h1>
        {result && (
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
            {result.total} total{result.total !== 1 && "es"}
          </span>
        )}
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>En atención</strong> = el usuario pulsó Llamar. Cierra el caso
        cuando hayas atendido la emergencia o libera el crédito si no hubo
        contacto.
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
              placeholder="Nombre, email, ID..."
              className="h-9 w-64 rounded-lg border border-gray-300 px-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Estado</label>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            >
              <option value="">Todos</option>
              <option value="calling">En atención</option>
              <option value="active">Listos para llamar</option>
              <option value="inactive">Cerrados</option>
            </select>
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

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="rounded-lg border border-[#e5e7eb] bg-white overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : !result || result.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Phone className="h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm text-gray-400">
              No se encontraron créditos de emergencia
            </p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      Usuario
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      Llamada iniciada
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      Monto
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      Cierre
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {result.data.map((credit) => (
                    <tr
                      key={credit.credit_id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">
                          {credit.user_name || "—"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {credit.user_email}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${statusStyle(credit.status)}`}
                        >
                          {statusLabel(credit.status)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                        {formatDt(credit.call_initiated_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                        {credit.amount_usd != null
                          ? `$${credit.amount_usd.toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-600">
                        {formatCloseCell(credit)}
                      </td>
                      <td className="px-4 py-3">
                        {credit.status === "calling" ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={actionLoadingId === credit.credit_id}
                              onClick={() =>
                                handleCloseAttended(credit.credit_id)
                              }
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Atendida
                            </button>
                            <button
                              type="button"
                              disabled={actionLoadingId === credit.credit_id}
                              onClick={() => handleRelease(credit.credit_id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                              No contactado
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:hidden divide-y divide-gray-100">
              {result.data.map((credit) => (
                <div key={credit.credit_id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {credit.user_name || "—"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {credit.user_email}
                      </p>
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${statusStyle(credit.status)}`}
                    >
                      {statusLabel(credit.status)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    {credit.call_initiated_at && (
                      <span>Llamada: {formatDt(credit.call_initiated_at)}</span>
                    )}
                    {credit.amount_usd != null && (
                      <span>${credit.amount_usd.toFixed(2)}</span>
                    )}
                  </div>
                  {credit.status === "calling" && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={actionLoadingId === credit.credit_id}
                        onClick={() => handleCloseAttended(credit.credit_id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Atendida
                      </button>
                      <button
                        type="button"
                        disabled={actionLoadingId === credit.credit_id}
                        onClick={() => handleRelease(credit.credit_id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        No contactado
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500">
                {result.total} crédito{result.total !== 1 && "s"} · Página{" "}
                {page} de {totalPages || 1}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
