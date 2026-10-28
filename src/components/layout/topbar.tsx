"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/hooks/use-auth"
import { useProviderCredits } from "@/hooks/use-provider-credits"
import { formatCreditBalance } from "@/lib/format-credit-balance"
import { ROUTES } from "@/lib/constants"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import {
  Menu,
  User,
  LogOut,
  LayoutDashboard,
  Megaphone,
  PlusCircle,
  Wallet,
  CalendarCheck,
  Package,
} from "lucide-react"
import { KynooLogo } from "@/components/brand/kynoo-logo"
import { PoweredByEleva } from "@/components/brand/powered-by-eleva"

const mobileNavItems = [
  { label: "Inicio", href: ROUTES.DASHBOARD, icon: LayoutDashboard, exact: true },
  { label: "Mis Promociones", href: ROUTES.PROMOTIONS, icon: Megaphone },
  { label: "Reservas", href: ROUTES.RESERVATIONS, icon: CalendarCheck },
  { label: "Envíos", href: ROUTES.PRODUCT_ORDERS, icon: Package },
  { label: "Publicar", href: ROUTES.NEW_PROMOTION, icon: PlusCircle },
  { label: "Créditos", href: ROUTES.CREDITS, icon: Wallet },
  { label: "Perfil", href: ROUTES.PROFILE, icon: User },
]

function getPageTitle(pathname: string): string {
  if (pathname === ROUTES.DASHBOARD) return "Inicio"
  if (pathname === ROUTES.NEW_PROMOTION) return "Nueva Publicación"
  if (pathname.startsWith(ROUTES.PROMOTIONS)) return "Promociones"
  if (pathname.startsWith(ROUTES.RESERVATIONS)) return "Reservas"
  if (pathname.startsWith(ROUTES.PRODUCT_ORDERS)) return "Envíos"
  if (pathname === ROUTES.CREDITS) return "Créditos"
  if (pathname === ROUTES.PROFILE) return "Perfil"
  return "Panel Proveedor"
}

export function Topbar() {
  const { user, logout } = useAuth()
  const { balance, isBalanceLoading } = useProviderCredits()
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isProvider = user?.role_code === "provider"

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?"

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center border-b border-border/60 bg-white px-4 md:px-6">
      {/* Mobile menu */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild className="md:hidden">
          <Button variant="ghost" size="icon" className="mr-2">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-[260px] flex-col p-0">
          <div className="flex h-14 items-center gap-2 px-5">
            <KynooLogo height={26} />
            <span className="text-[10px] font-medium uppercase tracking-wider text-white bg-[#3f0068] px-1.5 py-0.5 rounded">
              Proveedor
            </span>
          </div>
          <Separator />
          <nav className="flex-1 px-3 py-3 space-y-0.5">
            {mobileNavItems.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <div className="flex justify-center border-t border-border/60 p-4">
            <PoweredByEleva />
          </div>
        </SheetContent>
      </Sheet>

      {/* Page title */}
      <h1 className="text-sm font-semibold text-foreground">
        {getPageTitle(pathname)}
      </h1>

      {/* Spacer */}
      <div className="flex-1" />

      {isProvider && (
        <Link
          href={ROUTES.CREDITS}
          className={cn(
            "flex items-center gap-1.5 rounded-md border border-[#4a6b1e]/25 mr-2",
            "bg-[#4a6b1e]/10 px-2.5 py-1 text-xs font-semibold text-[#4a6b1e]",
            "hover:bg-[#4a6b1e]/15 transition-colors shrink-0",
          )}
          title="Créditos publicitarios"
        >
          <Wallet className="h-3.5 w-3.5" />
          {isBalanceLoading ? (
            <span className="tabular-nums">…</span>
          ) : balance !== null ? (
            <span className="tabular-nums">{formatCreditBalance(balance)}</span>
          ) : (
            <span>—</span>
          )}
        </Link>
      )}

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="gap-2 px-2 hover:bg-muted max-w-[min(100%,16rem)]"
          >
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="text-xs bg-muted text-foreground font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline text-sm font-medium text-foreground truncate">
              {user?.full_name || "Proveedor"}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {isProvider && (
            <>
              <DropdownMenuItem asChild>
                <Link href={ROUTES.CREDITS} className="cursor-pointer">
                  <Wallet className="mr-2 h-4 w-4" />
                  Créditos
                  <span className="ml-auto tabular-nums font-semibold text-[#4a6b1e]">
                    {isBalanceLoading
                      ? "…"
                      : balance !== null
                        ? formatCreditBalance(balance)
                        : "—"}
                  </span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem asChild>
            <Link href={ROUTES.PROFILE} className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              Perfil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={logout}
            className="text-destructive focus:text-destructive cursor-pointer"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
