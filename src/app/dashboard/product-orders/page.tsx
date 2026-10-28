"use client"

import { useCallback, useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  RotateCcw,
  Search,
} from "lucide-react"
import { api } from "@/lib/api-client"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  ADMIN_FILTER_INPUT_CLASS,
  ADMIN_FILTER_LABEL_CLASS,
  ADMIN_FILTER_PANEL_CLASS,
  ROUTES,
} from "@/lib/constants"
import type { ProductOrder, ProductShippingStatus } from "@/types"

const LIMIT = 25

const SHIPPING_LABELS: Record<string, string> = {
  pending: "Pendiente",
  shipped: "Enviado",
  delivered: "Entregado",
}

const SHIPPING_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800",
  shipped: "bg-blue-50 text-blue-800",
  delivered: "bg-emerald-50 text-emerald-700",
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

export default function ProductOrdersPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<ProductOrder[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [shippingFilter, setShippingFilter] = useState<"" | ProductShippingStatus>("")
  const [searchInput, setSearchInput] = useState("")
  const [appliedSearch, setAppliedSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await api.productOrders.list(
        LIMIT,
        (page - 1) * LIMIT,
        "paid",
        shippingFilter || undefined,
        appliedSearch || undefined,
      )
      setItems(res.items)
      setTotal(res.total)
    } catch {
      setError("No se pudieron cargar las órdenes de producto")
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron cargar los envíos.",
      })
    } finally {
      setIsLoading(false)
    }
  }, [page, shippingFilter, appliedSearch, toast])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  function handleSearchSubmit(e?: FormEvent) {
    e?.preventDefault()
    setAppliedSearch(searchInput.trim())
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Envíos de productos</h1>
        <p className="text-sm text-muted-foreground">
          Órdenes pagadas de tus productos. Marca enviado y entregado desde el detalle.
        </p>
      </div>

      <div className={ADMIN_FILTER_PANEL_CLASS}>
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="flex-1 space-y-1">
            <label className={ADMIN_FILTER_LABEL_CLASS}>Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className={`${ADMIN_FILTER_INPUT_CLASS} pl-9`}
                placeholder="Cliente, producto, ID…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className={ADMIN_FILTER_LABEL_CLASS}>Envío</label>
            <select
              className={ADMIN_FILTER_INPUT_CLASS}
              value={shippingFilter}
              onChange={(e) => {
                setShippingFilter(e.target.value as "" | ProductShippingStatus)
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
                setShippingFilter("")
                setPage(1)
              }}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>

      {isLoading ? (
        <Skeleton className="h-[320px] w-full rounded-lg" />
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay órdenes con esos filtros.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Producto</th>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Monto</th>
                <th className="px-3 py-2 font-medium">Envío</th>
                <th className="px-3 py-2 font-medium">Pagado</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {items.map((order) => {
                const ship = order.shipping_status || "pending"
                return (
                  <tr key={order.id} className="border-t border-border/60">
                    <td className="px-3 py-3">
                      <p className="font-medium text-foreground">
                        {order.product_title_snapshot}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.id.slice(0, 8)}…
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p>{order.buyer_full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.buyer_email || "—"}
                      </p>
                    </td>
                    <td className="px-3 py-3">{formatUsd(order.amount_usd)}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          SHIPPING_STYLES[ship] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {SHIPPING_LABELS[ship] || ship}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {formatDate(order.paid_at)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={ROUTES.PRODUCT_ORDER_DETAIL(order.id)}>Ver</Link>
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {total > LIMIT ? (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {total} órdenes · página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => p + 1)}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
