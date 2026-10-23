"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Loader2 } from "lucide-react"
import { adminApi } from "@/lib/admin-api"
import { ApiError } from "@/lib/api-client"
import { ROUTES } from "@/lib/constants"
import type {
  AdminSubscriptionCharge,
  AdminSubscriptionContract,
  AdminSubscriptionContractDetail,
} from "@/types"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const STATUS_LABELS: Record<string, string> = {
  incomplete: "Incompleta",
  active: "Activa",
  past_due: "Pago pendiente",
  action_required: "Verificación pendiente",
  cancelled: "Cancelada",
  expired: "Vencida",
  pending: "Pendiente",
  processing: "En proceso",
  paid: "Pagado",
  failed: "Rechazado",
  refunded: "Reembolsado",
}

const KIND_LABELS: Record<string, string> = {
  initial: "Alta",
  renewal: "Renovación",
  interval_change: "Paso a anual",
}

function day(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return format(date, "dd MMM yyyy", { locale: es })
}

function money(value: number | string): string {
  return Number(value).toFixed(2)
}

export default function AdminSubscriptionContractsPage() {
  const params = useParams<{ id: string }>()
  const promotionId = params.id
  const [title, setTitle] = useState("Kynoo Pet Care")
  const [rows, setRows] = useState<AdminSubscriptionContract[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AdminSubscriptionContractDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refundCharge, setRefundCharge] = useState<AdminSubscriptionCharge | null>(null)
  const [reason, setReason] = useState("")
  const [refundLoading, setRefundLoading] = useState(false)
  const [refundError, setRefundError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminApi.petCareSubscriptions.list(promotionId)
      setTitle(data.promotion_title)
      setRows(data.items)
    } catch {
      setError("No se pudieron cargar los contratos.")
    } finally {
      setLoading(false)
    }
  }, [promotionId])

  useEffect(() => {
    void load()
  }, [load])

  async function openContract(id: string) {
    if (openId === id) {
      setOpenId(null)
      setDetail(null)
      return
    }
    setOpenId(id)
    setDetail(null)
    setDetailLoading(true)
    try {
      setDetail(await adminApi.petCareSubscriptions.get(id))
    } catch {
      setError("No se pudo cargar el historial de cargos.")
      setOpenId(null)
    } finally {
      setDetailLoading(false)
    }
  }

  async function confirmRefund() {
    if (!refundCharge || !openId) return
    const text = reason.trim()
    if (!text) {
      setRefundError("El motivo es obligatorio.")
      return
    }
    setRefundLoading(true)
    setRefundError(null)
    try {
      await adminApi.petCareSubscriptions.refund(refundCharge.id, text)
      setRefundCharge(null)
      setReason("")
      setDetail(await adminApi.petCareSubscriptions.get(openId))
      await load()
    } catch (err) {
      setRefundError(
        err instanceof ApiError ? err.message : "No se pudo reembolsar el cargo.",
      )
    } finally {
      setRefundLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={ROUTES.ADMIN_PUBLICATIONS}
          className="text-sm text-[#4a6b1e] hover:underline"
        >
          Publicaciones
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-gray-900">
          Contratos · {title}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Usuario, intervalo, estado, periodo, próximo cobro e intentos. El
          reembolso solo aparece en un cargo pagado y no cierra el contrato ni
          libera el cupo.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          Cargando contratos...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-12 text-center text-sm text-gray-500">
          Esta ficha todavía no tiene contratos.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="text-xs font-medium">Usuario</TableHead>
                <TableHead className="text-xs font-medium">Intervalo</TableHead>
                <TableHead className="text-xs font-medium">Estado</TableHead>
                <TableHead className="text-xs font-medium">Periodo</TableHead>
                <TableHead className="text-xs font-medium">Próximo cobro</TableHead>
                <TableHead className="text-xs font-medium">Intentos</TableHead>
                <TableHead className="text-xs font-medium" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <TableRow>
                    <TableCell className="text-sm">
                      <div className="font-medium text-gray-900">{row.user_name}</div>
                      <div className="text-xs text-gray-500">{row.user_email}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.interval === "yearly" ? "Anual" : "Mensual"}
                      <div className="text-xs text-gray-500">USD {money(row.amount_usd)}</div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {STATUS_LABELS[row.status] || row.status}
                      {row.cancel_at_period_end ? (
                        <div className="text-xs text-amber-700">Cancela al fin del periodo</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {day(row.current_period_start)} — {day(row.current_period_end)}
                    </TableCell>
                    <TableCell className="text-xs text-gray-600">
                      {row.cancel_at_period_end ? "No renueva" : day(row.next_charge_at)}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{row.failed_attempts}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void openContract(row.id)}
                      >
                        {openId === row.id ? "Ocultar cargos" : "Ver cargos"}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {openId === row.id ? (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-gray-50">
                        {detailLoading || !detail ? (
                          <div className="flex items-center py-4 text-sm text-gray-500">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Cargando cargos...
                          </div>
                        ) : detail.charges.length === 0 ? (
                          <p className="py-3 text-sm text-gray-500">Sin cargos.</p>
                        ) : (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="text-xs">Tipo</TableHead>
                                <TableHead className="text-xs">Estado</TableHead>
                                <TableHead className="text-xs">Monto</TableHead>
                                <TableHead className="text-xs">Transaction ID</TableHead>
                                <TableHead className="text-xs">Authorization Code</TableHead>
                                <TableHead className="text-xs" />
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {detail.charges.map((charge) => (
                                <TableRow key={charge.id}>
                                  <TableCell className="text-sm">
                                    {KIND_LABELS[charge.kind] || charge.kind}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {STATUS_LABELS[charge.status] || charge.status}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    USD {money(charge.amount_usd)}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">
                                    {charge.nuvei_transaction_id || "—"}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">
                                    {charge.authorization_code || "—"}
                                  </TableCell>
                                  <TableCell>
                                    {charge.refundable ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setRefundError(null)
                                          setReason("")
                                          setRefundCharge(charge)
                                        }}
                                      >
                                        Reembolsar
                                      </Button>
                                    ) : null}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        open={refundCharge != null}
        onOpenChange={(open) => {
          if (!open && !refundLoading) setRefundCharge(null)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reembolsar cargo</DialogTitle>
            <DialogDescription>
              {refundCharge
                ? `Se reversan USD ${money(refundCharge.amount_usd)} en Nuvei. El contrato sigue igual y el cupo no se libera.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Motivo del reembolso"
            maxLength={500}
          />
          {refundError ? (
            <p className="text-sm text-red-700">{refundError}</p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={refundLoading}
              onClick={() => setRefundCharge(null)}
            >
              Cancelar
            </Button>
            <Button type="button" disabled={refundLoading} onClick={() => void confirmRefund()}>
              {refundLoading ? "Reembolsando..." : "Reembolsar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
