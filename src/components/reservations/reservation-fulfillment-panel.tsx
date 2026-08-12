"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { Loader2, Upload } from "lucide-react"
import { api, ApiError } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import { FulfillmentPhaseBadge } from "./fulfillment-phase-badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { PromotionPaidOrder } from "@/types"

interface ReservationFulfillmentPanelProps {
  order: PromotionPaidOrder
  onUpdated: (order: PromotionPaidOrder) => void
}

export function ReservationFulfillmentPanel({
  order,
  onUpdated,
}: ReservationFulfillmentPanelProps) {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [schedulingNotes, setSchedulingNotes] = useState(
    order.fulfillment?.scheduling_notes || "",
  )
  const [deliveryDescription, setDeliveryDescription] = useState(
    order.fulfillment?.delivery_description || "",
  )
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loadingStep, setLoadingStep] = useState<"contact" | "delivery" | null>(
    null,
  )

  if (order.status === "refunded") {
    return (
      <section className="rounded-lg border border-border/60 p-5 space-y-3 bg-white">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">
            Entrega del servicio
          </h3>
          <FulfillmentPhaseBadge phase="refunded" />
        </div>
        <p className="text-sm text-muted-foreground">
          Esta reserva fue reembolsada. Ya no se puede registrar contacto ni
          evidencia de entrega.
        </p>
        {order.fulfillment?.admin_notes ? (
          <p className="text-sm text-muted-foreground bg-zinc-50 border border-border/60 rounded-md p-3">
            {order.fulfillment.admin_notes}
          </p>
        ) : null}
      </section>
    )
  }

  if (order.status !== "paid") {
    return null
  }

  const phase = order.fulfillment_phase || "pending_contact"
  const fulfillment = order.fulfillment

  async function refreshOrder() {
    const fresh = await api.reservations.get(order.id)
    onUpdated(fresh)
  }

  async function handleConfirmContact() {
    setLoadingStep("contact")
    try {
      await api.reservations.confirmContact(order.id, schedulingNotes)
      await refreshOrder()
      toast({
        title: "Contacto registrado",
        description: "Ahora puedes marcar el servicio como realizado cuando lo completes.",
      })
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err instanceof ApiError ? err.message : "No se pudo registrar el contacto.",
      })
    } finally {
      setLoadingStep(null)
    }
  }

  function handleFileChange(file: File | null) {
    setSelectedFile(file)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(file ? URL.createObjectURL(file) : null)
  }

  async function handleSubmitDelivery() {
    if (!selectedFile) {
      toast({
        variant: "destructive",
        title: "Foto obligatoria",
        description: "Sube una foto del servicio prestado.",
      })
      return
    }
    if (deliveryDescription.trim().length < 10) {
      toast({
        variant: "destructive",
        title: "Descripción requerida",
        description: "Describe brevemente el servicio (mínimo 10 caracteres).",
      })
      return
    }

    setLoadingStep("delivery")
    try {
      await api.reservations.submitDelivery(
        order.id,
        selectedFile,
        deliveryDescription,
      )
      handleFileChange(null)
      if (fileRef.current) fileRef.current.value = ""
      await refreshOrder()
      toast({
        title: "Servicio registrado",
        description: "Kynoo revisará la evidencia para continuar con tu pago.",
      })
    } catch (err) {
      const description =
        err instanceof ApiError
          ? err.message
          : "No se pudo enviar la evidencia."
      const title =
        err instanceof ApiError ? err.title || "Error" : "Error"
      toast({
        variant: "destructive",
        title,
        description,
      })
    } finally {
      setLoadingStep(null)
    }
  }

  return (
    <section className="rounded-lg border border-border/60 p-5 space-y-4 bg-white">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground">
          Entrega del servicio
        </h3>
        <FulfillmentPhaseBadge phase={phase} />
      </div>

      {phase === "pending_contact" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Paso 1: confirma que ya te comunicaste con el cliente y acordaron la
            cita o el servicio.
          </p>
          <div className="space-y-2">
            <Label htmlFor="scheduling-notes" className="text-xs">
              Notas de la cita (opcional)
            </Label>
            <Textarea
              id="scheduling-notes"
              placeholder="Ej. Baño programado el viernes 10:00 en el local"
              value={schedulingNotes}
              onChange={(e) => setSchedulingNotes(e.target.value)}
              maxLength={500}
              rows={3}
              className="text-sm resize-none"
            />
          </div>
          <Button
            type="button"
            className="bg-[#4a6b1e] hover:bg-[#3d5a18] text-white"
            onClick={handleConfirmContact}
            disabled={loadingStep === "contact"}
          >
            {loadingStep === "contact" ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            Confirmar contacto y agenda
          </Button>
        </div>
      )}

      {(phase === "scheduled" || phase === "rejected") && (
        <div className="space-y-4">
          {phase === "rejected" && fulfillment?.admin_notes ? (
            <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-md p-3">
              <span className="font-medium">Motivo del rechazo: </span>
              {fulfillment.admin_notes}
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Paso 2: cuando hayas prestado el servicio, sube una foto y una breve
            descripción. La foto es obligatoria.
          </p>
          <div className="space-y-2">
            <Label htmlFor="delivery-photo" className="text-xs">
              Foto del servicio
            </Label>
            <input
              ref={fileRef}
              id="delivery-photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) =>
                handleFileChange(e.target.files?.[0] ?? null)
              }
            />
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2 h-auto py-3"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4 shrink-0" />
              <span className="text-sm truncate">
                {selectedFile ? selectedFile.name : "Seleccionar imagen (JPG, PNG, WebP)"}
              </span>
            </Button>
            {previewUrl ? (
              <div className="relative w-full max-w-xs aspect-[4/3] rounded-md overflow-hidden border border-border/60">
                <Image
                  src={previewUrl}
                  alt="Vista previa"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="delivery-description" className="text-xs">
              Descripción del servicio
            </Label>
            <Textarea
              id="delivery-description"
              placeholder="Ej. Baño completo, corte de uñas y limpieza de oídos"
              value={deliveryDescription}
              onChange={(e) => setDeliveryDescription(e.target.value)}
              maxLength={500}
              rows={3}
              className="text-sm resize-none"
            />
          </div>
          <Button
            type="button"
            className="bg-[#4a6b1e] hover:bg-[#3d5a18] text-white"
            onClick={handleSubmitDelivery}
            disabled={loadingStep === "delivery"}
          >
            {loadingStep === "delivery" ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : null}
            {phase === "rejected" ? "Reenviar evidencia" : "Marcar servicio realizado"}
          </Button>
        </div>
      )}

      {phase === "submitted" && fulfillment && (
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Tu evidencia está en revisión por el equipo Kynoo. Te notificaremos
            cuando sea verificada.
          </p>
          {fulfillment.photo_url ? (
            <div className="relative w-full max-w-sm aspect-[4/3] rounded-md overflow-hidden border border-border/60">
              <Image
                src={fulfillment.photo_url}
                alt="Evidencia del servicio"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : null}
          {fulfillment.delivery_description ? (
            <p>
              <span className="font-medium text-foreground">Descripción: </span>
              {fulfillment.delivery_description}
            </p>
          ) : null}
        </div>
      )}

      {phase === "verified" && fulfillment && (
        <div className="space-y-3 text-sm">
          <p className="text-emerald-700">
            Servicio verificado por Kynoo. Continuaremos con el proceso de pago
            correspondiente.
          </p>
          {fulfillment.photo_url ? (
            <div className="relative w-full max-w-sm aspect-[4/3] rounded-md overflow-hidden border border-border/60">
              <Image
                src={fulfillment.photo_url}
                alt="Evidencia verificada"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : null}
          {fulfillment.delivery_description ? (
            <p className="text-muted-foreground">
              {fulfillment.delivery_description}
            </p>
          ) : null}
        </div>
      )}
    </section>
  )
}
