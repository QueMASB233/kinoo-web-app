"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  ROUTES,
  BENEFIT_TYPE_LABELS,
  PROMOTION_TYPE_LABELS,
} from "@/lib/constants"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StatusBadge } from "./status-badge"
import { ActiveToggle } from "./active-toggle"
import { MoreHorizontal, Pencil, Search, PlusCircle } from "lucide-react"
import type { Promotion } from "@/types"

type FilterTab = "all" | "active" | "inactive"

interface PromotionsTableProps {
  promotions: Promotion[]
  onPromotionUpdated: (id: string, updates: Partial<Promotion>) => void
}

const benefitBadgeColors: Record<string, string> = {
  discount: "bg-teal-50 text-teal-700 border-teal-200",
  free_product: "bg-violet-50 text-violet-700 border-violet-200",
  service: "bg-sky-50 text-sky-700 border-sky-200",
  points_only: "bg-orange-50 text-orange-700 border-orange-200",
}

export function PromotionsTable({
  promotions,
  onPromotionUpdated,
}: PromotionsTableProps) {
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<FilterTab>("all")

  const filtered = useMemo(() => {
    let result = promotions

    if (tab === "active") {
      result = result.filter((p) => p.is_active && p.status === "active")
    } else if (tab === "inactive") {
      result = result.filter((p) => !p.is_active || p.status !== "active")
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter((p) => p.title.toLowerCase().includes(q))
    }

    return result
  }, [promotions, tab, search])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as FilterTab)}
        >
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs px-3">
              Todas ({promotions.length})
            </TabsTrigger>
            <TabsTrigger value="active" className="text-xs px-3">
              Activas (
              {
                promotions.filter(
                  (p) => p.is_active && p.status === "active",
                ).length
              }
              )
            </TabsTrigger>
            <TabsTrigger value="inactive" className="text-xs px-3">
              Inactivas (
              {
                promotions.filter(
                  (p) => !p.is_active || p.status !== "active",
                ).length
              }
              )
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 w-[200px] text-sm"
            />
          </div>
          <Button size="sm" className="h-9 bg-[#4a6b1e] hover:bg-[#3d5a18] text-white" asChild>
            <Link href={ROUTES.NEW_PROMOTION}>
              <PlusCircle className="mr-2 h-3.5 w-3.5" />
              Nueva
            </Link>
          </Button>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          {search
            ? "No se encontraron resultados."
            : "No hay publicaciones en esta categoría."}
        </div>
      ) : (
        <div className="border rounded-lg border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-muted/30">
                <TableHead className="text-xs font-medium">Título</TableHead>
                <TableHead className="text-xs font-medium">Tipo</TableHead>
                <TableHead className="text-xs font-medium">Beneficio</TableHead>
                <TableHead className="text-xs font-medium">Condición</TableHead>
                <TableHead className="text-xs font-medium">Estado</TableHead>
                <TableHead className="text-xs font-medium">Stock</TableHead>
                <TableHead className="text-xs font-medium">Fechas</TableHead>
                <TableHead className="text-xs font-medium text-center">
                  Canjes
                </TableHead>
                <TableHead className="text-xs font-medium text-center">
                  Activa
                </TableHead>
                <TableHead className="text-xs font-medium w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((promo) => (
                <TableRow key={promo.id}>
                  <TableCell className="text-sm font-medium max-w-[200px] truncate">
                    <Link
                      href={ROUTES.EDIT_PROMOTION(promo.id)}
                      className="hover:text-muted-foreground transition-colors underline-offset-4 hover:underline"
                    >
                      {promo.title}
                    </Link>
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
                    {promo.type === "service" ? (
                      promo.service_price != null &&
                      Number(promo.service_price) > 0 ? (
                        <Badge
                          variant="outline"
                          className="text-xs font-normal tabular-nums bg-sky-50 text-sky-700 border-sky-200"
                        >
                          {Number(promo.service_price).toLocaleString("es-EC", {
                            style: "currency",
                            currency: "USD",
                          })}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs font-normal bg-slate-50 text-slate-600 border-slate-200"
                        >
                          Sin precio
                        </Badge>
                      )
                    ) : promo.min_referral_points_required > 0 ? (
                      <Badge
                        variant="outline"
                        className="text-xs font-normal tabular-nums bg-orange-50 text-orange-700 border-orange-200"
                      >
                        {promo.min_referral_points_required} pts mín.
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-xs font-normal bg-emerald-50 text-emerald-700 border-emerald-200"
                      >
                        Gratis
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={promo.status}
                      isActive={promo.is_active}
                      reason={promo.deactivation_reason}
                      adminSuspended={promo.admin_suspended}
                      adminSuspendedReason={promo.admin_suspended_reason}
                    />
                  </TableCell>
                  <TableCell className="text-sm tabular-nums text-muted-foreground">
                    {promo.stock_total != null
                      ? `${promo.stock_remaining ?? 0} / ${promo.stock_total}`
                      : "Ilimitado"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(promo.start_date), "dd MMM", {
                      locale: es,
                    })}{" "}
                    —{" "}
                    {format(new Date(promo.end_date), "dd MMM yy", {
                      locale: es,
                    })}
                  </TableCell>
                  <TableCell className="text-sm text-center tabular-nums">
                    {promo.redemptions_count}
                  </TableCell>
                  <TableCell className="text-center">
                    <ActiveToggle
                      promotionId={promo.id}
                      isActive={promo.is_active}
                      adminSuspended={promo.admin_suspended}
                      onToggled={(newValue) =>
                        onPromotionUpdated(promo.id, { is_active: newValue })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link
                            href={ROUTES.EDIT_PROMOTION(promo.id)}
                            className="cursor-pointer"
                          >
                            <Pencil className="mr-2 h-3.5 w-3.5" />
                            Editar
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
