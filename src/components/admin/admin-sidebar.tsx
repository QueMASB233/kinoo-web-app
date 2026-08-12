"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  ClipboardCheck,
  Megaphone,
  Ticket,
  ScrollText,
  Activity,
  Phone,
  BookOpen,
  Wallet,
  PackageCheck,
  Building2,
  Users,
  LogOut,
  Menu,
  X,
} from "lucide-react"
import { ROUTES } from "@/lib/constants"
import { useAdminBadges } from "@/providers/admin-provider"
import { cn } from "@/lib/utils"
import { KynooLogo } from "@/components/brand/kynoo-logo"
import { PoweredByEleva } from "@/components/brand/powered-by-eleva"

interface NavItem {
  icon: React.ElementType
  label: string
  href: string
  badge?: number
}

interface AdminSidebarProps {
  userName: string
  onLogout: () => void
}

export function AdminSidebar({ userName, onLogout }: AdminSidebarProps) {
  const pathname = usePathname()
  const { pendingReviewCount, pendingFulfillmentCount } = useAdminBadges()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navItems: NavItem[] = [
    { icon: LayoutDashboard, label: "Dashboard", href: ROUTES.ADMIN_DASHBOARD },
    {
      icon: ClipboardCheck,
      label: "Revisión",
      href: ROUTES.ADMIN_REVIEW,
      badge: pendingReviewCount,
    },
    {
      icon: Megaphone,
      label: "Publicaciones",
      href: ROUTES.ADMIN_PUBLICATIONS,
    },
    {
      icon: Ticket,
      label: "Códigos referido",
      href: ROUTES.ADMIN_REFERRAL_CODES,
    },
    {
      icon: Building2,
      label: "Proveedores",
      href: ROUTES.ADMIN_PROVIDERS,
    },
    {
      icon: Users,
      label: "Usuarios",
      href: ROUTES.ADMIN_APP_USERS,
    },
    { icon: ScrollText, label: "Auditoría", href: ROUTES.ADMIN_AUDIT_LOGS },
    { icon: Activity, label: "Eventos", href: ROUTES.ADMIN_EVENTS },
    {
      icon: Phone,
      label: "Créditos Activos",
      href: ROUTES.ADMIN_EMERGENCY_CREDITS,
    },
    {
      icon: Wallet,
      label: "Créditos publicitarios",
      href: ROUTES.ADMIN_AD_CREDITS,
    },
    {
      icon: PackageCheck,
      label: "Servicios",
      href: ROUTES.ADMIN_PROMOTION_FULFILLMENTS,
      badge: pendingFulfillmentCount,
    },
    {
      icon: BookOpen,
      label: "Base de Conocimiento",
      href: ROUTES.ADMIN_KNOWLEDGE,
    },
  ]

  const isActive = (href: string) => pathname === href

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-gray-200 px-5">
        <Link href={ROUTES.ADMIN_DASHBOARD} aria-label="KYNOO — Dashboard">
          <KynooLogo height={26} />
        </Link>
        <span className="rounded bg-gray-900 px-1.5 py-0.5 text-[10px] font-medium text-white uppercase tracking-wider">
          Admin
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive(item.href)
                ? "bg-gray-100 text-gray-900"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-700",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {item.badge != null && item.badge > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
                {item.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* Powered by + User + Logout */}
      <div className="space-y-3 border-t border-gray-200 p-4">
        <div className="flex justify-center">
          <PoweredByEleva />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">
              {userName}
            </p>
          </div>
          <button
            onClick={onLogout}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed left-4 top-3 z-50 rounded-lg border border-gray-200 bg-white p-2 shadow-sm md:hidden"
      >
        {mobileOpen ? (
          <X className="h-5 w-5 text-gray-600" />
        ) : (
          <Menu className="h-5 w-5 text-gray-600" />
        )}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/20 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-[240px] border-r border-gray-200 bg-white transition-transform md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {sidebarContent}
      </aside>
    </>
  )
}
