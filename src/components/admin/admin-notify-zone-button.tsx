"use client"

import { useState } from "react"
import { Bell, Info, Loader2 } from "lucide-react"
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
import type { Promotion, PromotionNotificationAudience } from "@/types"

interface AdminNotifyZoneButtonProps {
  promotion: Promotion
  onUpdated: (updated: Promotion) => void
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

  async function openDialog() {
    setDialogOpen(true)
    setAudience(null)
    setAudienceError(null)
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
    if (!audience || audience.location_count <= 0) return
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

  const notifiedLabel = promotion.users_notified_at
    ? `Notificada ${formatUsersNotifiedAt(promotion.users_notified_at)}${
        promotion.users_notified_count != null
          ? ` · ${promotion.users_notified_count}`
          : ""
      }`
    : "Sin notificar"

  return (
    <div className="flex flex-col items-start gap-1.5">
      <span
        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${
          alreadyNotified
            ? "border-sky-200 bg-sky-50 text-sky-800"
            : "border-gray-200 bg-gray-50 text-gray-600"
        }`}
      >
        {notifiedLabel}
      </span>
      {canNotify && (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => void openDialog()}
          >
            <Bell className="mr-1 h-3 w-3" />
            {alreadyNotified ? "Volver a notificar" : "Notificar zona"}
          </Button>
          {alreadyNotified && (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-600"
                    aria-label="Aviso de reenvío"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  {ADMIN_RESEND_NOTIFY_WARNING}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {alreadyNotified ? "Volver a notificar" : "Notificar zona"}
            </DialogTitle>
            <DialogDescription>
              {alreadyNotified
                ? ADMIN_RESEND_NOTIFY_WARNING
                : "Se enviará un push a los usuarios en el área de los puntos actuales."}
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-gray-700">
            {loadingAudience ? (
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
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={sending}
            >
              Cancelar
            </Button>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
