"use client"

import { useEffect, useState } from "react"
import { Download, Loader2 } from "lucide-react"
import {
  ADMIN_FILTER_INPUT_CLASS,
  ADMIN_FILTER_LABEL_CLASS,
  ADMIN_FILTER_SELECT_CLASS,
  FULFILLMENT_PHASE_LABELS,
  PROMOTION_PAID_ORDER_STATUS_LABELS,
} from "@/lib/constants"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export type ProviderReservationsCsvFilters = {
  orderStatus: string
  fulfillmentPhase: string
  dateFrom: string
  dateTo: string
}

const ORDER_STATUS_EXPORT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todas" },
  ...Object.entries(PROMOTION_PAID_ORDER_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
]

const FULFILLMENT_PHASE_EXPORT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todas las fases" },
  ...(
    [
      "pending_contact",
      "scheduled",
      "submitted",
      "verified",
      "rejected",
      "refunded",
    ] as const
  ).map((value) => ({
    value,
    label: FULFILLMENT_PHASE_LABELS[value] ?? value,
  })),
]

type ProviderCsvExportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialOrderStatus?: string
  initialFulfillmentPhase?: string
  onDownload: (filters: ProviderReservationsCsvFilters) => Promise<Blob>
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export function ProviderCsvExportDialog({
  open,
  onOpenChange,
  initialOrderStatus = "",
  initialFulfillmentPhase = "",
  onDownload,
}: ProviderCsvExportDialogProps) {
  const [orderStatus, setOrderStatus] = useState("")
  const [fulfillmentPhase, setFulfillmentPhase] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setOrderStatus(initialOrderStatus)
    setFulfillmentPhase(initialFulfillmentPhase)
    setDateFrom("")
    setDateTo("")
  }, [open, initialOrderStatus, initialFulfillmentPhase])

  async function handleDownload() {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setError("La fecha inicial no puede ser mayor que la fecha final.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const blob = await onDownload({
        orderStatus,
        fulfillmentPhase,
        dateFrom,
        dateTo,
      })
      const now = new Date()
      const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`
      triggerBlobDownload(blob, `reservas_proveedor_${stamp}.csv`)
      onOpenChange(false)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo exportar el archivo CSV",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar reservas</DialogTitle>
          <DialogDescription>
            Elige estado de pago, fase de entrega y rango de fechas. La búsqueda
            activa del listado también se aplica al exportar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div>
            <label className={`${ADMIN_FILTER_LABEL_CLASS} block mb-1`}>
              Estado de pago
            </label>
            <select
              value={orderStatus}
              onChange={(e) => setOrderStatus(e.target.value)}
              className={`${ADMIN_FILTER_SELECT_CLASS} w-full min-w-0`}
            >
              {ORDER_STATUS_EXPORT_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={`${ADMIN_FILTER_LABEL_CLASS} block mb-1`}>
              Fase de entrega
            </label>
            <select
              value={fulfillmentPhase}
              onChange={(e) => setFulfillmentPhase(e.target.value)}
              className={`${ADMIN_FILTER_SELECT_CLASS} w-full min-w-0`}
            >
              {FULFILLMENT_PHASE_EXPORT_OPTIONS.map((o) => (
                <option key={o.value || "all_phases"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`${ADMIN_FILTER_LABEL_CLASS} block mb-1`}>
                Desde
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={ADMIN_FILTER_INPUT_CLASS}
              />
            </div>
            <div>
              <label className={`${ADMIN_FILTER_LABEL_CLASS} block mb-1`}>
                Hasta
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={ADMIN_FILTER_INPUT_CLASS}
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={handleDownload}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Download className="h-4 w-4 mr-1" />
                Descargar CSV
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
