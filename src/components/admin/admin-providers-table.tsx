"use client"

import { useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react"
import { adminApi } from "@/lib/admin-api"
import { ApiError } from "@/lib/api-client"
import {
  ADMIN_FILTER_INPUT_CLASS,
  ADMIN_FILTER_LABEL_CLASS,
  ADMIN_FILTER_PANEL_CLASS,
  ADMIN_FILTER_SELECT_CLASS,
} from "@/lib/constants"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type {
  AdminCreateProviderRequest,
  AdminProviderListItem,
  ProviderStatusCode,
} from "@/types"

interface AdminProvidersTableProps {
  providers: AdminProviderListItem[]
  onProvidersChange: (providers: AdminProviderListItem[]) => void
  onReload: () => void
  isLoading: boolean
  searchInput: string
  onSearchInputChange: (value: string) => void
  onSearch: () => void
  onReset: () => void
  hasActiveFilters: boolean
  page: number
  total: number
  totalPages: number
  pageSize: number
  onPageChange: (page: number) => void
}

const STATUS_LABELS: Record<ProviderStatusCode, string> = {
  active: "Activo",
  blocked: "Bloqueado",
  suspended: "Suspendido",
}

const STATUS_BADGE_CLASS: Record<ProviderStatusCode, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  blocked: "bg-red-50 text-red-700 border-red-200",
  suspended: "bg-amber-50 text-amber-800 border-amber-200",
}

function formatCredits(value: string): string {
  const n = Number.parseFloat(value)
  if (!Number.isFinite(n)) return value
  return n.toLocaleString("es-EC", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function CopyProviderIdButton({ providerId }: { providerId: string }) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(providerId)
      setCopied(true)
      toast({
        title: "ID copiado",
        description: "El ID del proveedor se copió al portapapeles.",
      })
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo copiar el ID.",
      })
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="shrink-0 rounded p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
      aria-label="Copiar ID del proveedor"
      title="Copiar ID del proveedor"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

function toListItem(updated: {
  id: string
  full_name: string
  email: string
  status_code: ProviderStatusCode
  email_verified: boolean
  account_activated: boolean
  balance_credits: string
  created_at: string | null
}): AdminProviderListItem {
  return {
    id: updated.id,
    full_name: updated.full_name,
    email: updated.email,
    status_code: updated.status_code,
    email_verified: updated.email_verified,
    account_activated: updated.account_activated,
    balance_credits: updated.balance_credits,
    created_at: updated.created_at,
  }
}

export function AdminProvidersTable({
  providers,
  onProvidersChange,
  onReload,
  isLoading,
  searchInput,
  onSearchInputChange,
  onSearch,
  onReset,
  hasActiveFilters,
  page,
  total,
  totalPages,
  pageSize,
  onPageChange,
}: AdminProvidersTableProps) {
  const { toast } = useToast()
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AdminProviderListItem | null>(
    null,
  )
  const [saving, setSaving] = useState(false)

  const [formName, setFormName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formCredits, setFormCredits] = useState("")
  const [formStatus, setFormStatus] = useState<ProviderStatusCode>("active")

  function resetCreateForm() {
    setFormName("")
    setFormEmail("")
    setFormCredits("")
  }

  function openCreate() {
    resetCreateForm()
    setCreateOpen(true)
  }

  function openEdit(provider: AdminProviderListItem) {
    setFormName(provider.full_name)
    setFormEmail(provider.email)
    setFormStatus(provider.status_code)
    setEditTarget(provider)
  }

  async function handleCreate() {
    const full_name = formName.trim()
    const email = formEmail.trim().toLowerCase()
    const creditsRaw = formCredits.trim()
    const initial_credits = creditsRaw ? Number.parseFloat(creditsRaw) : 0

    if (!full_name || !email) {
      toast({
        variant: "destructive",
        title: "Campos requeridos",
        description: "Nombre y correo son obligatorios.",
      })
      return
    }

    if (creditsRaw && (!Number.isFinite(initial_credits) || initial_credits < 0)) {
      toast({
        variant: "destructive",
        title: "Créditos inválidos",
        description: "Los créditos iniciales deben ser un número ≥ 0.",
      })
      return
    }

    const payload: AdminCreateProviderRequest = {
      full_name,
      email,
      initial_credits,
    }

    setSaving(true)
    try {
      const created = await adminApi.providers.create(payload)

      const emailNote = created.welcome_email_sent
        ? "Se envió el correo de bienvenida."
        : "La cuenta se creó; el correo de bienvenida no se pudo enviar."

      toast({
        title: "Proveedor creado",
        description: `${created.email}. ${emailNote}`,
      })
      setCreateOpen(false)
      resetCreateForm()
      onReload()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err instanceof ApiError
            ? err.message
            : "No se pudo crear el proveedor.",
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate() {
    if (!editTarget) return

    const full_name = formName.trim()
    const email = formEmail.trim().toLowerCase()

    if (!full_name) {
      toast({
        variant: "destructive",
        title: "Nombre requerido",
      })
      return
    }

    setSaving(true)
    try {
      const updated = await adminApi.providers.update(editTarget.id, {
        full_name,
        email: editTarget.account_activated ? undefined : email,
        status_code: formStatus,
      })
      const listItem = toListItem(updated)
      onProvidersChange(
        providers.map((p) => (p.id === listItem.id ? listItem : p)),
      )
      toast({ title: "Proveedor actualizado" })
      setEditTarget(null)
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err instanceof ApiError
            ? err.message
            : "No se pudo actualizar el proveedor.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className={ADMIN_FILTER_PANEL_CLASS}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1 max-w-md space-y-1">
            <label className={ADMIN_FILTER_LABEL_CLASS}>Buscar</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => onSearchInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    onSearch()
                  }
                }}
                placeholder="Nombre, correo o ID…"
                className={cn(ADMIN_FILTER_INPUT_CLASS, "pl-9 pr-3")}
              />
            </div>
          </div>

          <Button type="button" onClick={onSearch} className="h-9 gap-2">
            <Search className="h-3.5 w-3.5" />
            Buscar
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onReset}
            className="h-9 gap-2"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Limpiar
          </Button>

          <Button type="button" onClick={openCreate} className="h-9 gap-2">
            <Plus className="h-4 w-4" />
            Nuevo proveedor
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Cargando proveedores…
        </div>
      ) : providers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-12 text-center text-sm text-gray-500">
          {hasActiveFilters
            ? "No hay proveedores que coincidan con la búsqueda."
            : "Aún no hay proveedores. Crea uno para empezar."}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="text-xs font-medium">ID proveedor</TableHead>
                <TableHead className="text-xs font-medium">Nombre</TableHead>
                <TableHead className="text-xs font-medium">Correo</TableHead>
                <TableHead className="text-xs font-medium">Estado</TableHead>
                <TableHead className="text-xs font-medium">Acceso</TableHead>
                <TableHead className="text-xs font-medium text-right">
                  Créditos
                </TableHead>
                <TableHead className="text-xs font-medium">Alta</TableHead>
                <TableHead className="text-xs font-medium text-right">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-1 min-w-0 max-w-[140px]">
                      <span
                        className="font-mono text-xs text-gray-600 truncate"
                        title={item.id}
                      >
                        {item.id}
                      </span>
                      <CopyProviderIdButton providerId={item.id} />
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {item.full_name}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {item.email}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={STATUS_BADGE_CLASS[item.status_code]}
                    >
                      {STATUS_LABELS[item.status_code]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        variant="outline"
                        className={
                          item.account_activated
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }
                      >
                        {item.account_activated ? "Con OTP" : "Pendiente OTP"}
                      </Badge>
                      {item.email_verified ? (
                        <Badge
                          variant="outline"
                          className="bg-blue-50 text-blue-700 border-blue-200"
                        >
                          Email verificado
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {formatCredits(item.balance_credits)}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                    {item.created_at
                      ? format(new Date(item.created_at), "dd MMM yyyy", {
                          locale: es,
                        })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() => openEdit(item)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500">
              {total} proveedor{total !== 1 ? "es" : ""} · Página {page} de{" "}
              {totalPages} · {pageSize} por página
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onPageChange(Math.max(1, page - 1))}
                disabled={page <= 1 || isLoading}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                disabled={page >= totalPages || isLoading}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo proveedor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-500">
              Se creará la cuenta en el sistema. El proveedor iniciará sesión
              en el panel con su correo y un código OTP. Opcionalmente se envía
              un email de bienvenida con el enlace al panel.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="create-provider-name">Nombre completo</Label>
              <input
                id="create-provider-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Clínica Veterinaria Ejemplo"
                className={ADMIN_FILTER_INPUT_CLASS}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-provider-email">Correo</Label>
              <input
                id="create-provider-email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="contacto@ejemplo.com"
                className={ADMIN_FILTER_INPUT_CLASS}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-provider-credits">
                Créditos iniciales (opcional)
              </Label>
              <input
                id="create-provider-credits"
                type="number"
                min={0}
                step="0.01"
                value={formCredits}
                onChange={(e) => setFormCredits(e.target.value)}
                placeholder="0"
                className={ADMIN_FILTER_INPUT_CLASS}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreate()}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Crear proveedor"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar proveedor</DialogTitle>
          </DialogHeader>
          {editTarget ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-gray-50 px-3 py-2">
                <p className="text-xs text-gray-500">ID del proveedor</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <p className="font-mono text-xs break-all">{editTarget.id}</p>
                  <CopyProviderIdButton providerId={editTarget.id} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-provider-name">Nombre completo</Label>
                <input
                  id="edit-provider-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className={ADMIN_FILTER_INPUT_CLASS}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-provider-email">Correo</Label>
                <input
                  id="edit-provider-email"
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  disabled={editTarget.account_activated}
                  className={cn(
                    ADMIN_FILTER_INPUT_CLASS,
                    editTarget.account_activated && "opacity-60 cursor-not-allowed",
                  )}
                />
                {editTarget.account_activated ? (
                  <p className="text-xs text-gray-500">
                    El correo no se puede cambiar después del primer acceso.
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-provider-status">Estado de la cuenta</Label>
                <select
                  id="edit-provider-status"
                  value={formStatus}
                  onChange={(e) =>
                    setFormStatus(e.target.value as ProviderStatusCode)
                  }
                  className={ADMIN_FILTER_SELECT_CLASS}
                >
                  <option value="active">Activo — puede iniciar sesión</option>
                  <option value="blocked">Bloqueado — sin acceso</option>
                  <option value="suspended">Suspendido — sin acceso temporal</option>
                </select>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditTarget(null)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleUpdate()}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Guardar cambios"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
