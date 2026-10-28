"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ROUTES } from "@/lib/constants"
import { useAuth } from "@/hooks/use-auth"
import {
  LayoutDashboard,
  Megaphone,
  PlusCircle,
  User,
  Wallet,
  LogOut,
  CalendarCheck,
  Package,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { KynooLogo } from "@/components/brand/kynoo-logo"
import { PoweredByEleva } from "@/components/brand/powered-by-eleva"

const navItems = [
  {
    label: "Inicio",
    href: ROUTES.DASHBOARD,
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Mis Promociones",
    href: ROUTES.PROMOTIONS,
    icon: Megaphone,
  },
  {
    label: "Reservas",
    href: ROUTES.RESERVATIONS,
    icon: CalendarCheck,
  },
  {
    label: "Envíos",
    href: ROUTES.PRODUCT_ORDERS,
    icon: Package,
  },
  {
    label: "Publicar",
    href: ROUTES.NEW_PROMOTION,
    icon: PlusCircle,
  },
  {
    label: "Créditos",
    href: ROUTES.CREDITS,
    icon: Wallet,
  },
  {
    label: "Perfil",
    href: ROUTES.PROFILE,
    icon: User,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { logout } = useAuth()

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden h-dvh max-h-dvh w-[240px] flex-col overflow-hidden border-r border-border/60 bg-white md:flex">
      {/* Logo — fijo arriba */}
      <div className="flex h-14 shrink-0 items-center gap-2 px-5">
        <Link
          href={ROUTES.DASHBOARD}
          className="flex items-center"
          aria-label="KYNOO — Inicio"
        >
          <KynooLogo height={26} />
        </Link>
        <span className="rounded bg-[#3f0068] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
          Proveedor
        </span>
      </div>

      <Separator className="shrink-0" />

      {/* Navigation — única zona con scroll */}
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-3 py-3">
        {navItems.map((item) => {
          const active = isActive(item.href, item.exact)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Powered by + Logout — fijo abajo */}
      <div className="mt-auto shrink-0 space-y-3 border-t border-border/60 p-3">
        <div className="flex justify-center px-1">
          <PoweredByEleva />
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={logout}
        >
          <LogOut className="mr-3 h-4 w-4" />
          Cerrar sesión
        </Button>
      </div>
    </aside>
  )
}
