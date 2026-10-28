"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ArrowLeft, Loader2 } from "lucide-react"
import { api, ApiError } from "@/lib/api-client"
import { CheckoutSnapshotView } from "@/components/admin/checkout-snapshot-view"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { ROUTES } from "@/lib/constants"
import type { ProductOrder, ProductShippingStatus } from "@/types"

const SHIPPING_LABELS: Record<string, string> = {
  pending: "Pendiente de envío",
  shipped: "Enviado",
  delivered: "Entregado",
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

function nextShippingAction(
  status: ProductShippingStatus | null | undefined,
): ProductShippingStatus | null {
  if (!status || status === "pending") return "shipped"
  if (status === "shipped") return "delivered"
  return null
}

export default function ProductOrderDetailPage() {
  const params = useParams()
  const orderId = params.id as string
  const { toast } = useToast()
  const [order, setOrder] = useState<ProductOrder | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await api.productOrders.get(orderId)
      setOrder(data)
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo cargar la orden.",
      })
    } finally {
      setIsLoading(false)
    }
  }, [orderId, toast])

  useEffect(() => {
    load()
  }, [load])

  async function advanceShipping() {
    if (!order) return
    const next = nextShippingAction(order.shipping_status)
    if (!next) return
    setIsUpdating(true)
    try {
      const updated = await api.productOrders.updateShipping(order.id, next)
      setOrder(updated)
      toast({
        title: "Envío actualizado",
        description: SHIPPING_LABELS[next] || next,
      })
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "No se pudo actualizar el estado de envío."
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      })
    } finally {
      setIsUpdating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Skeleton className="h-9 w-[200px]" />
        <Skeleton className="h-[360px] rounded-lg" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="space-y-4 max-w-2xl">
        <Button asChild variant="ghost" size="sm">
          <Link href={ROUTES.PRODUCT_ORDERS}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">Orden no encontrada.</p>
      </div>
    )
  }

  const ship = order.shipping_status || "pending"
  const next = order.status === "paid" ? nextShippingAction(ship) : null

  return (
    <div className="space-y-4 max-w-2xl">
      <Button asChild variant="ghost" size="sm">
        <Link href={ROUTES.PRODUCT_ORDERS}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a envíos
        </Link>
      </Button>

      <div>
        <h1 className="text-xl font-semibold">{order.product_title_snapshot}</h1>
        <p className="text-sm text-muted-foreground">
          {formatUsd(order.amount_usd)} · {SHIPPING_LABELS[ship] || ship}
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Cliente</p>
            <p className="font-medium">{order.buyer_full_name || "—"}</p>
            <p className="text-xs text-muted-foreground">{order.buyer_email}</p>
            <p className="text-xs text-muted-foreground">{order.buyer_phone || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Fechas</p>
            <p className="text-xs">Pagado: {formatDate(order.paid_at)}</p>
            <p className="text-xs">Enviado: {formatDate(order.shipped_at)}</p>
            <p className="text-xs">Entregado: {formatDate(order.delivered_at)}</p>
          </div>
        </div>

        <CheckoutSnapshotView snapshot={order.checkout_snapshot} />

        {next ? (
          <Button onClick={advanceShipping} disabled={isUpdating}>
            {isUpdating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {next === "shipped" ? "Marcar como enviado" : "Marcar como entregado"}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
