"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Check, Copy, Search } from "lucide-react"
import {
  BENEFIT_TYPE_LABELS,
  PROMOTION_TYPE_LABELS,
  ADMIN_FILTER_INPUT_CLASS,
  ADMIN_FILTER_LABEL_CLASS,
  ADMIN_FILTER_SELECT_CLASS,
  ADMIN_FILTER_PANEL_CLASS,
} from "@/lib/constants"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdminNotifyZoneButton } from "./admin-notify-zone-button"
import { AdminSuspensionToggle } from "./admin-suspension-toggle"
import type { Promotion, PromotionType } from "@/types"

type FilterTab = "all" | "active" | "suspended" | "rejected"
type TypeFilter = "all" | PromotionType

const TYPE_FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "Todos los tipos" },
  { value: "promotion", label: PROMOTION_TYPE_LABELS.promotion },
  { value: "service", label: PROMOTION_TYPE_LABELS.service },
]

interface AdminPublicationsTableProps {
  promotions: Promotion[]
  onPromotionUpdated: (updated: Promotion) => void
}

const benefitBadgeColors: Record<string, string> = {
  discount: "bg-teal-50 text-teal-700 border-teal-200",
  free_product: "bg-violet-50 text-violet-700 border-violet-200",
  service: "bg-sky-50 text-sky-700 border-sky-200",
  points_only: "bg-orange-50 text-orange-700 border-orange-200",
}

function statusLabel(promo: Promotion) {
  if (promo.admin_suspended) return "Suspendida (admin)"
  if (promo.status === "rejected") return "Rechazada"
  if (promo.status === "pending_review") return "En revisión"
  if (promo.is_active && promo.status === "active") return "Activa"
  return "Inactiva"
}

function statusClass(promo: Promotion) {
  if (promo.admin_suspended) return "bg-red-50 text-red-800 border-red-200"
  if (promo.status === "rejected") return "bg-red-50 text-red-700 border-red-200"
  if (promo.status === "pending_review")
    return "bg-amber-50 text-amber-700 border-amber-200"
  if (promo.is_active && promo.status === "active")
    return "bg-emerald-50 text-emerald-700 border-emerald-200"
  return "bg-gray-50 text-gray-600 border-gray-200"
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
      className="shrink-0 rounded p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
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

export function AdminPublicationsTable({
  promotions,
  onPromotionUpdated,
}: AdminPublicationsTableProps) {
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<FilterTab>("all")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")

  const filtered = useMemo(() => {
    let result = promotions

    if (tab === "active") {
      result = result.filter(
        (p) => !p.admin_suspended && p.is_active && p.status === "active",
      )
    } else if (tab === "suspended") {
      result = result.filter((p) => p.admin_suspended)
    } else if (tab === "rejected") {
      result = result.filter((p) => p.status === "rejected")
    }

    if (typeFilter !== "all") {
      result = result.filter((p) => p.type === typeFilter)
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          (p.business_name || "").toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          (p.provider_id || "").toLowerCase().includes(q),
      )
    }

    return result
  }, [promotions, tab, typeFilter, search])

  const hasActiveFilters =
    tab !== "all" || typeFilter !== "all" || search.trim().length > 0

  return (
    <div className="space-y-4">
      <div className={ADMIN_FILTER_PANEL_CLASS}>
        <div className="space-y-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as FilterTab)}>
            <TabsList>
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="active">Activas</TabsTrigger>
              <TabsTrigger value="rejected">Rechazadas</TabsTrigger>
              <TabsTrigger value="suspended">Suspendidas</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1 max-w-md space-y-1">
              <label className={ADMIN_FILTER_LABEL_CLASS}>Buscar</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Título, negocio, ID publicación o ID proveedor…"
                  className={cn(ADMIN_FILTER_INPUT_CLASS, "pl-9 pr-3")}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className={ADMIN_FILTER_LABEL_CLASS} htmlFor="pub-type-filter">
                Tipo de publicación
              </label>
              <select
                id="pub-type-filter"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                className={ADMIN_FILTER_SELECT_CLASS}
              >
                {TYPE_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 py-12 text-center text-sm text-gray-500">
          {hasActiveFilters
            ? "No hay publicaciones que coincidan con los filtros aplicados."
            : "No hay publicaciones en esta categoría."}
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50">
                <TableHead className="text-xs font-medium">Título</TableHead>
                <TableHead className="text-xs font-medium">Tipo</TableHead>
                <TableHead className="text-xs font-medium">Beneficio</TableHead>
                <TableHead className="text-xs font-medium">Estado</TableHead>
                <TableHead className="text-xs font-medium">Aviso</TableHead>
                <TableHead className="text-xs font-medium">Proveedor</TableHead>
                <TableHead className="text-xs font-medium">Canjes</TableHead>
                <TableHead className="text-xs font-medium">Fechas</TableHead>
                <TableHead className="text-xs font-medium text-center">
                  Habilitada
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((promo) => (
                <TableRow key={promo.id}>
                  <TableCell className="text-sm font-medium max-w-[220px]">
                    <span className="truncate block" title={promo.title}>
                      {promo.title}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-normal">
                      {PROMOTION_TYPE_LABELS[promo.type] || promo.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs font-normal ${benefitBadgeColors[promo.benefit_type] || ""}`}
                    >
                      {BENEFIT_TYPE_LABELS[promo.benefit_type] ||
                        promo.benefit_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs font-normal ${statusClass(promo)}`}
                    >
                      {statusLabel(promo)}
                    </Badge>
                  </TableCell>
                  <TableCell className="align-top">
                    <AdminNotifyZoneButton
                      promotion={promo}
                      onUpdated={onPromotionUpdated}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-gray-500 max-w-[180px]">
                    {promo.provider_id ? (
                      <div className="flex items-center gap-1 min-w-0">
                        <span
                          className="font-mono truncate"
                          title={promo.provider_id}
                        >
                          {promo.provider_id}
                        </span>
                        <CopyProviderIdButton providerId={promo.provider_id} />
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-center tabular-nums">
                    {promo.redemptions_count}
                  </TableCell>
                  <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                    {format(new Date(promo.start_date), "dd MMM yy", {
                      locale: es,
                    })}{" "}
                    —{" "}
                    {format(new Date(promo.end_date), "dd MMM yy", {
                      locale: es,
                    })}
                  </TableCell>
                  <TableCell className="text-center">
                    <AdminSuspensionToggle
                      promotion={promo}
                      onUpdated={onPromotionUpdated}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
