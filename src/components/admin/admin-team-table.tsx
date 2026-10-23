"use client"

import { useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Loader2, Plus, RotateCcw, Search } from "lucide-react"
import { adminApi } from "@/lib/admin-api"
import { ApiError } from "@/lib/api-client"
import {
  ADMIN_FILTER_INPUT_CLASS,
  ADMIN_FILTER_LABEL_CLASS,
  ADMIN_FILTER_PANEL_CLASS,
  ADMIN_FILTER_SELECT_CLASS,
} from "@/lib/constants"
import { useToast } from "@/hooks/use-toast"
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
import type { AdminTeamListItem, TeamRoleCode } from "@/types"

const STATUS_LABELS: Record<AdminTeamListItem["status_code"], string> = {
  active: "Activo",
  blocked: "Bloqueado",
  suspended: "Suspendido",
}

interface AdminTeamTableProps {
  members: AdminTeamListItem[]
  isLoading: boolean
  searchInput: string
  onSearchInputChange: (value: string) => void
  onSearch: () => void
  onReset: () => void
  hasActiveFilters: boolean
  onReload: () => void
  page: number
  total: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function AdminTeamTable({
  members,
  isLoading,
  searchInput,
  onSearchInputChange,
  onSearch,
  onReset,
  hasActiveFilters,
  onReload,
  page,
  total,
  totalPages,
  onPageChange,
}: AdminTeamTableProps) {
  const { toast } = useToast()
  const [createOpen, setCreateOpen] = useState(false)
  const [formName, setFormName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formRole, setFormRole] = useState<TeamRoleCode>("operator_igs")
  const [saving, setSaving] = useState(false)

  function resetForm() {
    setFormName("")
    setFormEmail("")
    setFormRole("operator_igs")
  }

  async function handleCreate() {
    const full_name = formName.trim()
    const email = formEmail.trim().toLowerCase()
    if (full_name.length < 2 || !email) {
      toast({
        variant: "destructive",
        title: "Campos requeridos",
        description: "Nombre y correo son obligatorios.",
      })
      return
    }
    setSaving(true)
    try {
      const created = await adminApi.team.create({
        full_name,
        email,
        role_code: formRole,
      })
      const emailNote = created.welcome_email_sent
        ? "Se envió el correo con el enlace de ingreso."
        : "La cuenta se creó; el correo de bienvenida no se pudo enviar."
      toast({
        title: "Cuenta creada",
        description: `${created.role_label}: ${created.email}. ${emailNote}`,
      })
      setCreateOpen(false)
      resetForm()
      onReload()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof ApiError ? err.message : "No se pudo crear la cuenta.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className={ADMIN_FILTER_PANEL_CLASS}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1 space-y-1">
            <label className={ADMIN_FILTER_LABEL_CLASS}>Buscar</label>
            <input
              value={searchInput}
              onChange={(event) => onSearchInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onSearch()
              }}
              placeholder="Nombre, correo o ID"
              className={ADMIN_FILTER_INPUT_CLASS}
            />
          </div>
          <Button type="button" variant="outline" onClick={onSearch} className="h-9 gap-2">
            <Search className="h-3.5 w-3.5" />
            Buscar
          </Button>
          {hasActiveFilters ? (
            <Button type="button" variant="ghost" onClick={onReset} className="h-9 gap-2">
              <RotateCcw className="h-3.5 w-3.5" />
              Limpiar
            </Button>
          ) : null}
          <Button type="button" onClick={() => setCreateOpen(true)} className="h-9 gap-2">
            <Plus className="h-4 w-4" />
            Nueva cuenta
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          Cargando equipo…
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-12 text-center text-sm text-gray-500">
          {hasActiveFilters
            ? "No hay cuentas que coincidan con la búsqueda."
            : "Aún no hay operadores. Crea un Operador IGS o un Operador."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="text-xs font-medium">Nombre</TableHead>
                <TableHead className="text-xs font-medium">Correo</TableHead>
                <TableHead className="text-xs font-medium">Rol</TableHead>
                <TableHead className="text-xs font-medium">Estado</TableHead>
                <TableHead className="text-xs font-medium">Acceso</TableHead>
                <TableHead className="text-xs font-medium">Alta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm font-medium text-gray-900">
                    {item.full_name}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{item.email}</TableCell>
                  <TableCell className="text-sm text-gray-700">{item.role_label}</TableCell>
                  <TableCell className="text-sm text-gray-700">
                    {STATUS_LABELS[item.status_code] || item.status_code}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {item.account_activated ? "Ya ingresó" : "Pendiente de código"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {item.created_at
                      ? format(new Date(item.created_at), "d MMM yyyy", { locale: es })
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-500">
            <span>
              {total} cuenta{total === 1 ? "" : "s"} · página {page} de {totalPages}
            </span>
            <div className="flex gap-1">
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

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva cuenta de equipo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-500">
              El primer ingreso es con el correo y un código, igual que un proveedor.
              Esta pantalla no cambia el rol ni elimina la cuenta.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="team-name">Nombre</Label>
              <input
                id="team-name"
                value={formName}
                onChange={(event) => setFormName(event.target.value)}
                placeholder="Nombre y apellido"
                className={ADMIN_FILTER_INPUT_CLASS}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-email">Correo</Label>
              <input
                id="team-email"
                type="email"
                value={formEmail}
                onChange={(event) => setFormEmail(event.target.value)}
                placeholder="nombre@kynoo.ec"
                className={ADMIN_FILTER_INPUT_CLASS}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-role">Rol</Label>
              <select
                id="team-role"
                value={formRole}
                onChange={(event) => setFormRole(event.target.value as TeamRoleCode)}
                className={ADMIN_FILTER_SELECT_CLASS}
              >
                <option value="operator_igs">Operador IGS</option>
                <option value="operator">Operador</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleCreate()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear cuenta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
