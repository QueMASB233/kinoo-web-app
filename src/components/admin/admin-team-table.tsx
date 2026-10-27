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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  AdminTeamListItem,
  TeamCreateRoleCode,
  TeamListRoleCode,
  TeamRoleGroupFilter,
} from "@/types"

interface AdminTeamTableProps {
  members: AdminTeamListItem[]
  isLoading: boolean
  roleGroup: TeamRoleGroupFilter
  onRoleGroupChange: (group: TeamRoleGroupFilter) => void
  searchInput: string
  onSearchInputChange: (value: string) => void
  onSearch: () => void
  onReset: () => void
  hasActiveFilters: boolean
  onReload: () => void
  page: number
  total: number
  totalPages: number
  pageSize: number
  onPageChange: (page: number) => void
}

const STATUS_LABELS: Record<AdminTeamListItem["status_code"], string> = {
  active: "Activo",
  blocked: "Bloqueado",
  suspended: "Suspendido",
}

const STATUS_BADGE_CLASS: Record<AdminTeamListItem["status_code"], string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  blocked: "bg-red-50 text-red-700 border-red-200",
  suspended: "bg-amber-50 text-amber-800 border-amber-200",
}

const ROLE_BADGE_CLASS: Record<TeamListRoleCode, string> = {
  admin: "bg-violet-50 text-violet-800 border-violet-200",
  operator_igs: "bg-amber-50 text-amber-900 border-amber-200",
  operator: "bg-sky-50 text-sky-800 border-sky-200",
}

function CopyTextButton({
  value,
  label,
  successTitle,
}: {
  value: string
  label: string
  successTitle: string
}) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast({
        title: successTitle,
        description: `${label} copiado al portapapeles.`,
      })
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: `No se pudo copiar ${label.toLowerCase()}.`,
      })
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
      aria-label={`Copiar ${label.toLowerCase()}`}
      title={`Copiar ${label.toLowerCase()}`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

export function AdminTeamTable({
  members,
  isLoading,
  roleGroup,
  onRoleGroupChange,
  searchInput,
  onSearchInputChange,
  onSearch,
  onReset,
  hasActiveFilters,
  onReload,
  page,
  total,
  totalPages,
  pageSize,
  onPageChange,
}: AdminTeamTableProps) {
  const { toast } = useToast()
  const [createOpen, setCreateOpen] = useState(false)
  const [formName, setFormName] = useState("")
  const [formEmail, setFormEmail] = useState("")
  const [formRole, setFormRole] = useState<TeamCreateRoleCode>("operator_igs")
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
        title: "Operador creado",
        description: `${created.role_label}: ${created.email}. ${emailNote}`,
      })
      setCreateOpen(false)
      resetForm()
      onReload()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err instanceof ApiError ? err.message : "No se pudo crear la cuenta.",
      })
    } finally {
      setSaving(false)
    }
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="space-y-4">
      <div className={ADMIN_FILTER_PANEL_CLASS}>
        <div className="space-y-3">
          <Tabs
            value={roleGroup}
            onValueChange={(v) => onRoleGroupChange(v as TeamRoleGroupFilter)}
          >
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="admins">Admins</TabsTrigger>
              <TabsTrigger value="operators">Operadores</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] max-w-md flex-1 space-y-1">
              <label className={ADMIN_FILTER_LABEL_CLASS}>Buscar</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => onSearchInputChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
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
            <Button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="h-9 gap-2"
            >
              <Plus className="h-4 w-4" />
              Nuevo operador
            </Button>
          </div>
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
            ? "No hay cuentas que coincidan con los filtros."
            : "Aún no hay cuentas de equipo. Crea un Operador IGS o un Operador."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="text-xs font-medium">ID</TableHead>
                <TableHead className="text-xs font-medium">Nombre</TableHead>
                <TableHead className="text-xs font-medium">Correo</TableHead>
                <TableHead className="text-xs font-medium">Rol</TableHead>
                <TableHead className="text-xs font-medium">Estado</TableHead>
                <TableHead className="text-xs font-medium">Verificación</TableHead>
                <TableHead className="text-xs font-medium">Alta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex min-w-0 max-w-[140px] items-center gap-1">
                      <span
                        className="truncate font-mono text-xs text-gray-600"
                        title={item.id}
                      >
                        {item.id}
                      </span>
                      <CopyTextButton
                        value={item.id}
                        label="ID"
                        successTitle="ID copiado"
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium text-gray-900">
                    {item.full_name}
                  </TableCell>
                  <TableCell>
                    <div className="flex min-w-0 max-w-[220px] items-center gap-1">
                      <span
                        className="truncate text-sm text-gray-600"
                        title={item.email}
                      >
                        {item.email}
                      </span>
                      <CopyTextButton
                        value={item.email}
                        label="Correo"
                        successTitle="Correo copiado"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={ROLE_BADGE_CLASS[item.role_code]}
                    >
                      {item.role_label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={STATUS_BADGE_CLASS[item.status_code]}
                    >
                      {STATUS_LABELS[item.status_code] || item.status_code}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        item.email_verified
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-600"
                      }
                    >
                      {item.email_verified ? "Verificado" : "Sin verificar"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {item.created_at
                      ? format(new Date(item.created_at), "d MMM yyyy", {
                          locale: es,
                        })
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-500">
            <span>
              {from}–{to} de {total} cuenta{total === 1 ? "" : "s"} · página{" "}
              {page} de {totalPages}
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
            <DialogTitle>Nuevo operador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-500">
              El primer ingreso es con el correo y un código OTP, igual que un
              proveedor. Desde Equipo no se crean administradores ni se cambia
              el rol después del alta.
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
                onChange={(event) =>
                  setFormRole(event.target.value as TeamCreateRoleCode)
                }
                className={ADMIN_FILTER_SELECT_CLASS}
              >
                <option value="operator_igs">Operador IGS</option>
                <option value="operator">Operador</option>
              </select>
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
                "Crear operador"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
