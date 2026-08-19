"use client"

import { useState } from "react"
import { Bell, BellOff, Loader2 } from "lucide-react"
import { adminApi } from "@/lib/admin-api"
import { ApiError } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ADMIN_RESEND_NOTIFY_WARNING,
  formatUsersNotifiedAt,
  isActiveForZoneNotify,
} from "@/lib/promotion-notify"
import { cn } from "@/lib/utils"
import type { Promotion, PromotionNotificationAudience } from "@/types"

interface AdminNotifyZoneButtonProps {
  promotion: Promotion
  onUpdated: (updated: Promotion) => void
}

function notifyBlockedReason(promo: Promotion): string | null {
  if (promo.admin_suspended) {
    return "La publicación está suspendida. Reactívala para poder notificar la zona."
  }
  if (promo.status === "rejected") {
    return "Las publicaciones rechazadas no se pueden notificar."
  }
  if (promo.status === "pending_review") {
    return "Aún está en revisión. Apruébala antes de notificar."
  }
  if (!promo.is_active || promo.status !== "active") {
    return "Solo se puede notificar una publicación activa."
  }
  return null
}

export function AdminNotifyZoneButton({
  promotion,
  onUpdated,
}: AdminNotifyZoneButtonProps) {
  const { toast } = useToast()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loadingAudience, setLoadingAudience] = useState(false)
  const [sending, setSending] = useState(false)
  const [audience, setAudience] = useState<PromotionNotificationAudience | null>(
    null,
  )
  const [audienceError, setAudienceError] = useState<string | null>(null)

  const alreadyNotified = Boolean(promotion.users_notified_at)
  const canNotify = isActiveForZoneNotify(promotion)
  const blockedReason = canNotify ? null : notifyBlockedReason(promotion)

  const statusLabel = alreadyNotified
    ? `Notificada ${formatUsersNotifiedAt(promotion.users_notified_at!)}${
        promotion.users_notified_count != null
          ? ` · ${promotion.users_notified_count}`
          : ""
      }`
    : canNotify
      ? "Sin notificar"
      : "No disponible"

  async function openDialog() {
    setDialogOpen(true)
    setAudience(null)
    setAudienceError(null)
    if (!canNotify) return

    setLoadingAudience(true)
    try {
      const preview = await adminApi.publications.getNotificationAudience(
        promotion.id,
      )
      setAudience(preview)
      if (preview.location_count <= 0) {
        setAudienceError(
          "Esta publicación no tiene ubicaciones; no se puede notificar.",
        )
      }
    } catch (err) {
      setAudienceError(
        err instanceof ApiError
          ? err.message
          : "No se pudo estimar la audiencia.",
      )
    } finally {
      setLoadingAudience(false)
    }
  }

  async function confirmNotify() {
    if (!canNotify || !audience || audience.location_count <= 0) return
    setSending(true)
    try {
      await adminApi.publications.notifyUsers(promotion.id, {
        force: alreadyNotified,
      })
      onUpdated({
        ...promotion,
        users_notified_at: new Date().toISOString(),
        users_notified_count: audience.eligible_count,
      })
      toast({
        title: alreadyNotified ? "Reenvío encolado" : "Notificación encolada",
        description: `Se avisará a ~${audience.eligible_count} usuario${
          audience.eligible_count === 1 ? "" : "s"
        } en la zona.`,
      })
      setDialogOpen(false)
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err instanceof ApiError
            ? err.message
            : "No se pudo encolar la notificación.",
      })
    } finally {
      setSending(false)
    }
  }

  const Icon = alreadyNotified ? Bell : BellOff

  return (
    <>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => void openDialog()}
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                alreadyNotified
                  ? "text-sky-600 hover:bg-sky-50 hover:text-sky-700"
                  : canNotify
                    ? "text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    : "text-gray-300 hover:bg-gray-50 hover:text-gray-400",
              )}
              aria-label={statusLabel}
            >
              <Icon className="h-4 w-4" strokeWidth={alreadyNotified ? 2.25 : 1.75} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{statusLabel}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {!canNotify
                ? "Aviso de zona"
                : alreadyNotified
                  ? "Volver a notificar"
                  : "Notificar zona"}
            </DialogTitle>
            <DialogDescription>
              {!canNotify
                ? blockedReason
                : alreadyNotified
                  ? ADMIN_RESEND_NOTIFY_WARNING
                  : "Se enviará un push a los usuarios en el área de los puntos actuales."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 text-sm text-gray-700">
            {alreadyNotified && promotion.users_notified_at && (
              <p>
                Último aviso: {formatUsersNotifiedAt(promotion.users_notified_at)}
                {promotion.users_notified_count != null
                  ? ` · ${promotion.users_notified_count} usuario${
                      promotion.users_notified_count === 1 ? "" : "s"
                    }`
                  : ""}
              </p>
            )}
            {!alreadyNotified && canNotify && (
              <p className="text-gray-500">Esta publicación aún no se ha notificado.</p>
            )}

            {canNotify &&
              (loadingAudience ? (
                <span className="inline-flex items-center gap-2 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Estimando audiencia…
                </span>
              ) : audienceError ? (
                <p className="text-red-600">{audienceError}</p>
              ) : audience ? (
                <p>
                  Se avisará a ~{audience.eligible_count} usuario
                  {audience.eligible_count === 1 ? "" : "s"} en el área de estos
                  puntos (GPS reciente + segmentación + push activo).
                </p>
              ) : null)}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={sending}
            >
              {canNotify ? "Cancelar" : "Cerrar"}
            </Button>
            {canNotify && (
              <Button
                type="button"
                disabled={
                  sending ||
                  loadingAudience ||
                  Boolean(audienceError) ||
                  !audience ||
                  audience.location_count <= 0
                }
                onClick={() => void confirmNotify()}
              >
                {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {alreadyNotified ? "Reenviar" : "Notificar"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
