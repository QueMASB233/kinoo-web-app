"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Download, Loader2, Search } from "lucide-react"
import { adminApi } from "@/lib/admin-api"
import { ADMIN_FILTER_INPUT_CLASS, ADMIN_FILTER_SELECT_CLASS } from "@/lib/constants"
import type { AdminKynooRedemption } from "@/types"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const PAGE_SIZE = 20

const TYPE_LABELS: Record<string, string> = {
  promotion: "Promoción",
  service: "Servicio",
}

const STATUS_LABELS: Record<string, string> = {
  reserved: "Reservado",
  redeemed: "Canjeado",
  cancelled: "Cancelado",
}

function day(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return format(date, "dd MMM yyyy HH:mm", { locale: es })
}

function when(row: AdminKynooRedemption): string {
  if (row.status === "redeemed") return day(row.redeemed_at || row.reserved_at)
  return day(row.reserved_at)
}

export default function KynooRedemptionsPage() {
  const [rows, setRows] = useState<AdminKynooRedemption[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminApi.kynooRedemptions.list({
        page,
        limit: PAGE_SIZE,
        search: searchQuery || undefined,
        status: status || undefined,
      })
      setRows(data.items)
      setTotal(data.total)
    } catch {
      setError("No se pudieron cargar los canjes.")
    } finally {
      setLoading(false)
    }
  }, [page, searchQuery, status])

  useEffect(() => {
    void load()
  }, [load])

  async function downloadCsv() {
    setExporting(true)
    setError(null)
    try {
      const blob = await adminApi.kynooRedemptions.exportCsv({
        search: searchQuery || undefined,
        status: status || undefined,
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = "canjes_kynoo.csv"
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo descargar el CSV.")
    } finally {
      setExporting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Canjes Kynoo</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Promociones y servicios publicados por Kynoo. Las suscripciones no
            entran en este listado.
            {total > 0 ? <span className="text-gray-400"> · {total} en total</span> : null}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={exporting}
          onClick={() => void downloadCsv()}
        >
          {exporting ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-1.5 h-4 w-4" />
          )}
          CSV
        </Button>
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setSearchQuery(searchInput.trim())
          setPage(1)
        }}
      >
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Usuario, correo o publicación"
          className={`${ADMIN_FILTER_INPUT_CLASS} max-w-sm`}
        />
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value)
            setPage(1)
          }}
          className={ADMIN_FILTER_SELECT_CLASS}
        >
          <option value="">Todos los estados</option>
          <option value="reserved">Reservado</option>
          <option value="redeemed">Canjeado</option>
          <option value="cancelled">Cancelado</option>
        </select>
        <Button type="submit" variant="outline" size="sm">
          <Search className="mr-1.5 h-4 w-4" />
          Buscar
        </Button>
      </form>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          Cargando canjes...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-12 text-center text-sm text-gray-500">
          No hay canjes de Kynoo con ese criterio.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="text-xs font-medium">Usuario</TableHead>
                <TableHead className="text-xs font-medium">Publicación</TableHead>
                <TableHead className="text-xs font-medium">Tipo</TableHead>
                <TableHead className="text-xs font-medium">Estado</TableHead>
                <TableHead className="text-xs font-medium">Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium text-gray-900">{row.user_name}</div>
                    <div className="text-xs text-gray-500">{row.user_email}</div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-700">
                    {row.promotion_title}
                  </TableCell>
                  <TableCell className="text-sm text-gray-700">
                    {TYPE_LABELS[row.promotion_type] || row.promotion_type}
                  </TableCell>
                  <TableCell className="text-sm text-gray-700">
                    {STATUS_LABELS[row.status] || row.status}
                  </TableCell>
                  <TableCell className="text-sm text-gray-700">{when(row)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-500">
            <span>
              {total} canje{total === 1 ? "" : "s"} · página {page} de {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1 || loading}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages || loading}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
