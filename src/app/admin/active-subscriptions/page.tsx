"use client"

import { Fragment, useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Loader2, Search } from "lucide-react"
import { adminApi } from "@/lib/admin-api"
import { ApiError } from "@/lib/api-client"
import { ADMIN_FILTER_INPUT_CLASS } from "@/lib/constants"
import type { AdminSubscriptionContract, AdminSubscriptionNote } from "@/types"
import { CheckoutSnapshotView } from "@/components/admin/checkout-snapshot-view"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const PAGE_SIZE = 20
const NOTE_MAX = 2000

const INTERVAL_LABELS: Record<string, string> = {
  monthly: "Mensual",
  yearly: "Anual",
}

function day(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return format(date, "dd MMM yyyy", { locale: es })
}

function when(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return format(date, "dd MMM yyyy HH:mm", { locale: es })
}

export default function ActiveSubscriptionsPage() {
  const [rows, setRows] = useState<AdminSubscriptionContract[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [notes, setNotes] = useState<AdminSubscriptionNote[]>([])
  const [notesLoading, setNotesLoading] = useState(false)
  const [notesError, setNotesError] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminApi.activeSubscriptions.list({
        page,
        limit: PAGE_SIZE,
        search: searchQuery || undefined,
      })
      setRows(data.items)
      setTotal(data.total)
    } catch {
      setError("No se pudieron cargar las suscripciones activas.")
    } finally {
      setLoading(false)
    }
  }, [page, searchQuery])

  useEffect(() => {
    void load()
  }, [load])

  async function openContract(id: string) {
    if (openId === id) {
      setOpenId(null)
      setNotes([])
      setDraft("")
      setNotesError(null)
      return
    }
    setOpenId(id)
    setNotes([])
    setDraft("")
    setNotesError(null)
    setNotesLoading(true)
    try {
      const data = await adminApi.activeSubscriptions.notes(id)
      setNotes(data.items)
    } catch {
      setNotesError("No se pudieron cargar las notas.")
    } finally {
      setNotesLoading(false)
    }
  }

  async function saveNote() {
    if (!openId) return
    const text = draft.trim()
    if (!text) {
      setNotesError("La nota es obligatoria.")
      return
    }
    setSaving(true)
    setNotesError(null)
    try {
      const created = await adminApi.activeSubscriptions.addNote(openId, text)
      setNotes((current) => [...current, created])
      setDraft("")
    } catch (err) {
      setNotesError(
        err instanceof ApiError ? err.message : "No se pudo guardar la nota.",
      )
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Suscripciones activas</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Contratos activos de Kynoo Pet Care. El admin y el Operador IGS dejan
          aquí una nota. El reembolso de un cargo sigue en la ficha de la
          publicación.
          {total > 0 ? <span className="text-gray-400"> · {total} en total</span> : null}
        </p>
      </div>

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          setSearchQuery(searchInput.trim())
          setPage(1)
          setOpenId(null)
        }}
      >
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Usuario, correo o ficha"
          className={`${ADMIN_FILTER_INPUT_CLASS} max-w-sm`}
        />
        <Button type="submit" variant="outline" size="sm">
          <Search className="mr-1.5 h-4 w-4" />
          Buscar
        </Button>
      </form>

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
          No hay contratos activos con ese criterio.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="text-xs font-medium">Usuario</TableHead>
                <TableHead className="text-xs font-medium">Ficha</TableHead>
                <TableHead className="text-xs font-medium">Intervalo</TableHead>
                <TableHead className="text-xs font-medium">Fin de periodo</TableHead>
                <TableHead className="text-xs font-medium">Próximo cobro</TableHead>
                <TableHead className="text-xs font-medium">Intentos</TableHead>
                <TableHead className="text-xs font-medium" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <TableRow>
                    <TableCell>
                      <div className="font-medium text-gray-900">{row.user_name}</div>
                      <div className="text-xs text-gray-500">{row.user_email}</div>
                      <CheckoutSnapshotView
                        snapshot={row.checkout_snapshot}
                        compact
                        className="mt-1"
                      />
                    </TableCell>
                    <TableCell className="text-sm text-gray-700">
                      {row.promotion_title}
                    </TableCell>
                    <TableCell className="text-sm text-gray-700">
                      {INTERVAL_LABELS[row.interval] || row.interval}
                    </TableCell>
                    <TableCell className="text-sm text-gray-700">
                      {day(row.current_period_end)}
                      {row.cancel_at_period_end ? (
                        <div className="text-xs text-amber-700">Cancela al cierre</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-gray-700">
                      {day(row.next_charge_at)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-700">
                      {row.failed_attempts}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void openContract(row.id)}
                      >
                        {openId === row.id ? "Cerrar" : "Notas"}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {openId === row.id ? (
                    <TableRow className="hover:bg-white">
                      <TableCell colSpan={7} className="bg-gray-50">
                        {notesLoading ? (
                          <div className="flex items-center py-4 text-sm text-gray-500">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Cargando notas...
                          </div>
                        ) : (
                          <div className="space-y-4 py-2">
                            {notes.length === 0 ? (
                              <p className="text-sm text-gray-500">
                                Este contrato todavía no tiene notas.
                              </p>
                            ) : (
                              <ul className="space-y-3">
                                {notes.map((note) => (
                                  <li
                                    key={note.id}
                                    className="rounded-lg border border-gray-200 bg-white px-3 py-2"
                                  >
                                    <div className="text-xs text-gray-500">
                                      {note.author_name} · {when(note.created_at)}
                                    </div>
                                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">
                                      {note.body}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <div className="space-y-2">
                              <Textarea
                                value={draft}
                                maxLength={NOTE_MAX}
                                onChange={(event) => setDraft(event.target.value)}
                                placeholder="Nota del contrato"
                                rows={3}
                              />
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-xs text-gray-400">
                                  {draft.trim().length}/{NOTE_MAX}. La nota no se edita ni se borra.
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={saving || draft.trim().length === 0}
                                  onClick={() => void saveNote()}
                                >
                                  {saving ? "Guardando..." : "Agregar nota"}
                                </Button>
                              </div>
                            </div>
                            {notesError ? (
                              <p className="text-sm text-red-700">{notesError}</p>
                            ) : null}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-500">
            <span>
              {total} contrato{total === 1 ? "" : "s"} · página {page} de {totalPages}
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
