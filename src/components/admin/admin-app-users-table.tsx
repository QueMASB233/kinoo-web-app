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
  RotateCcw,
  Search,
} from "lucide-react"
import {
  ADMIN_FILTER_INPUT_CLASS,
  ADMIN_FILTER_LABEL_CLASS,
  ADMIN_FILTER_PANEL_CLASS,
  ADMIN_FILTER_SELECT_CLASS,
} from "@/lib/constants"
import { adminApi } from "@/lib/admin-api"
import { ApiError } from "@/lib/api-client"
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
  AdminAppUserListItem,
  AppUserRoleCode,
  AppUserStatusCode,
} from "@/types"

type RoleTab = "all" | AppUserRoleCode

interface AdminAppUsersTableProps {
  users: AdminAppUserListItem[]
  onUsersChange: (users: AdminAppUserListItem[]) => void
  isLoading: boolean
  roleTab: RoleTab
  onRoleTabChange: (tab: RoleTab) => void
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

const ROLE_LABELS: Record<AppUserRoleCode, string> = {
  owner: "Owner",
  member: "Member",
}

const ROLE_BADGE_CLASS: Record<AppUserRoleCode, string> = {
  owner: "bg-indigo-50 text-indigo-700 border-indigo-200",
  member: "bg-rose-50 text-rose-700 border-rose-200",
}

const STATUS_LABELS = {
  active: "Activo",
  blocked: "Bloqueado",
  suspended: "Suspendido",
} as const

const STATUS_BADGE_CLASS = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  blocked: "bg-red-50 text-red-700 border-red-200",
  suspended: "bg-amber-50 text-amber-800 border-amber-200",
} as const

function CopyUserIdButton({ userId }: { userId: string }) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(userId)
      setCopied(true)
      toast({
        title: "ID copiado",
        description: "El ID del usuario se copió al portapapeles.",
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
      aria-label="Copiar ID del usuario"
      title="Copiar ID del usuario"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  return format(new Date(value), "dd MMM yyyy", { locale: es })
}

export function AdminAppUsersTable({
  users,
  onUsersChange,
  isLoading,
  roleTab,
  onRoleTabChange,
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
}: AdminAppUsersTableProps) {
  const { toast } = useToast()
  const [editTarget, setEditTarget] = useState<AdminAppUserListItem | null>(null)
  const [formStatus, setFormStatus] = useState<AppUserStatusCode>("active")
  const [saving, setSaving] = useState(false)

  function openEdit(user: AdminAppUserListItem) {
    setFormStatus(user.status_code)
    setEditTarget(user)
  }

  async function handleUpdate() {
    if (!editTarget) return

    setSaving(true)
    try {
      const updated = await adminApi.appUsers.update(editTarget.id, {
        status_code: formStatus,
      })
      onUsersChange(users.map((u) => (u.id === updated.id ? updated : u)))

      const statusLabel = STATUS_LABELS[updated.status_code]
      toast({
        title: "Estado actualizado",
        description: `${updated.full_name} — ${statusLabel}`,
      })
      setEditTarget(null)
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err instanceof ApiError
            ? err.message
            : "No se pudo actualizar el usuario.",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className={ADMIN_FILTER_PANEL_CLASS}>
        <div className="space-y-3">
          <Tabs
            value={roleTab}
            onValueChange={(v) => onRoleTabChange(v as RoleTab)}
          >
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="owner">Owners</TabsTrigger>
              <TabsTrigger value="member">Members</TabsTrigger>
            </TabsList>
          </Tabs>

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
            <Button
              type="button"
              onClick={onSearch}
              className="h-9 gap-2"
            >
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
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Cargando usuarios…
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-12 text-center text-sm text-gray-500">
          {hasActiveFilters
            ? "No hay usuarios que coincidan con los filtros."
            : "Aún no hay usuarios registrados en la app."}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="text-xs font-medium">ID</TableHead>
                <TableHead className="text-xs font-medium">Nombre</TableHead>
                <TableHead className="text-xs font-medium">Correo</TableHead>
                <TableHead className="text-xs font-medium">Rol</TableHead>
                <TableHead className="text-xs font-medium">Estado</TableHead>
                <TableHead className="text-xs font-medium text-right">
                  Puntos
                </TableHead>
                <TableHead className="text-xs font-medium">Registro</TableHead>
                <TableHead className="text-xs font-medium">Alta</TableHead>
                <TableHead className="text-xs font-medium">
                  Último acceso
                </TableHead>
                <TableHead className="text-xs font-medium text-right">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-1 min-w-0 max-w-[132px]">
                      <span
                        className="font-mono text-xs text-gray-600 truncate"
                        title={item.id}
                      >
                        {item.id}
                      </span>
                      <CopyUserIdButton userId={item.id} />
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium max-w-[140px]">
                    <span className="truncate block" title={item.full_name}>
                      {item.full_name}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600 max-w-[180px]">
                    <span className="truncate block" title={item.email}>
                      {item.email}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={ROLE_BADGE_CLASS[item.role_code]}
                    >
                      {ROLE_LABELS[item.role_code]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={STATUS_BADGE_CLASS[item.status_code]}
                    >
                      {STATUS_LABELS[item.status_code]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {item.referral_points.toLocaleString("es-EC")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        item.registration_completed
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-50 text-slate-600 border-slate-200"
                      }
                    >
                      {item.registration_completed ? "Completo" : "Pendiente"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(item.created_at)}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                    {formatDate(item.last_login_at)}
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
              {total} usuario{total !== 1 ? "s" : ""} · Página {page} de{" "}
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

      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Estado del usuario</DialogTitle>
          </DialogHeader>
          {editTarget ? (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-gray-50 px-3 py-2 space-y-1">
                <p className="text-sm font-medium text-gray-900">
                  {editTarget.full_name}
                </p>
                <p className="text-xs text-gray-500">{editTarget.email}</p>
                <div className="flex items-center gap-1 pt-1">
                  <span className="font-mono text-xs text-gray-500 break-all">
                    {editTarget.id}
                  </span>
                  <CopyUserIdButton userId={editTarget.id} />
                </div>
                <Badge
                  variant="outline"
                  className={cn("mt-1", ROLE_BADGE_CLASS[editTarget.role_code])}
                >
                  {ROLE_LABELS[editTarget.role_code]}
                </Badge>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-user-status">Estado de la cuenta</Label>
                <select
                  id="edit-user-status"
                  value={formStatus}
                  onChange={(e) =>
                    setFormStatus(e.target.value as AppUserStatusCode)
                  }
                  className={ADMIN_FILTER_SELECT_CLASS}
                >
                  <option value="active">Activo — puede iniciar sesión</option>
                  <option value="blocked">Bloqueado — sin acceso</option>
                  <option value="suspended">
                    Suspendido — sin acceso temporal
                  </option>
                </select>
                <p className="text-xs text-gray-500">
                  Si el usuario tiene sesión abierta, perderá el acceso en la
                  próxima petición o al renovar el token.
                </p>
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
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
