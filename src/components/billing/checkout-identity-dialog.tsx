"use client"

import { useCallback, useEffect, useState } from "react"
import { api, ApiError } from "@/lib/api-client"
import { useAuth } from "@/hooks/use-auth"
import { useToast } from "@/hooks/use-toast"
import {
  DEFAULT_DIAL,
  DIAL_CODES,
  splitPhoneE164,
  validatePhoneParts,
} from "@/lib/phone-e164"
import type {
  BillingIdType,
  BillingMode,
  BillingProfileUpsert,
  CheckoutIdentityPayload,
} from "@/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CEDULA_RE = /^\d{10}$/
const RUC_RE = /^\d{13}$/
const PASSPORT_RE = /^[A-Za-z0-9]{5,20}$/

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (payload: CheckoutIdentityPayload) => void
  confirmLabel?: string
}

export function CheckoutIdentityDialog({
  open,
  onOpenChange,
  onConfirm,
  confirmLabel = "Guardar y continuar",
}: Props) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [dial, setDial] = useState(DEFAULT_DIAL)
  const [national, setNational] = useState("")
  const [mode, setMode] = useState<BillingMode>("final_consumer")
  const [idType, setIdType] = useState<BillingIdType | "">("")
  const [idNumber, setIdNumber] = useState("")
  const [legalName, setLegalName] = useState("")
  const [billingEmail, setBillingEmail] = useState("")
  const [billingAddress, setBillingAddress] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const parts = splitPhoneE164(user?.phone_e164)
      setDial(parts.dial)
      setNational(parts.national)
      const profile = await api.users.getBilling()
      setMode(profile.mode)
      setIdType(profile.id_type || "")
      setIdNumber(profile.id_number || "")
      setLegalName(profile.legal_name || "")
      setBillingEmail(profile.billing_email || user?.email || "")
      setBillingAddress(profile.billing_address_line || "")
    } catch (err) {
      toast({
        variant: "destructive",
        title: "No se pudo cargar facturación",
        description:
          err instanceof ApiError ? err.message : "Intenta de nuevo.",
      })
      setMode("final_consumer")
      setBillingEmail(user?.email || "")
    } finally {
      setLoading(false)
    }
  }, [toast, user?.email, user?.phone_e164])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  function handleConfirm() {
    const phoneResult = validatePhoneParts(dial, national, { required: true })
    if (!phoneResult.ok) {
      toast({
        variant: "destructive",
        title: "Teléfono requerido",
        description:
          phoneResult.error === "required"
            ? "Ingresa tu teléfono con código de país."
            : "Usa un teléfono válido con código de país.",
      })
      return
    }

    let billing: BillingProfileUpsert
    if (mode === "final_consumer") {
      billing = { mode: "final_consumer" }
    } else {
      if (!idType) {
        toast({
          variant: "destructive",
          title: "Revisa los datos",
          description: "Elige el tipo de identificación.",
        })
        return
      }
      const num = idNumber.trim()
      if (idType === "cedula" && !CEDULA_RE.test(num)) {
        toast({
          variant: "destructive",
          title: "Revisa los datos",
          description: "La cédula debe tener 10 dígitos.",
        })
        return
      }
      if (idType === "ruc" && !RUC_RE.test(num)) {
        toast({
          variant: "destructive",
          title: "Revisa los datos",
          description: "El RUC debe tener 13 dígitos.",
        })
        return
      }
      if (idType === "passport" && !PASSPORT_RE.test(num)) {
        toast({
          variant: "destructive",
          title: "Revisa los datos",
          description: "El pasaporte debe tener entre 5 y 20 caracteres.",
        })
        return
      }
      if (!legalName.trim()) {
        toast({
          variant: "destructive",
          title: "Revisa los datos",
          description: "Ingresa el nombre o razón social.",
        })
        return
      }
      const email = (billingEmail.trim() || user?.email || "").toLowerCase()
      if (!EMAIL_RE.test(email)) {
        toast({
          variant: "destructive",
          title: "Revisa los datos",
          description: "Ingresa un correo de facturación válido.",
        })
        return
      }
      if (!billingAddress.trim()) {
        toast({
          variant: "destructive",
          title: "Revisa los datos",
          description: "Ingresa la dirección de facturación.",
        })
        return
      }
      billing = {
        mode: "with_data",
        id_type: idType,
        id_number: num,
        legal_name: legalName.trim(),
        billing_email: email,
        billing_address_line: billingAddress.trim(),
      }
    }

    onConfirm({
      phone_e164: phoneResult.e164,
      billing,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Facturar a</DialogTitle>
          <DialogDescription>
            Confirma tu teléfono y a quién facturar. Al continuar se guardan en
            tu perfil y se usan en esta compra.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Teléfono de contacto</Label>
              <div className="flex gap-2">
                <Select value={dial} onValueChange={setDial}>
                  <SelectTrigger className="h-9 w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIAL_CODES.map((c) => (
                      <SelectItem key={c.dial} value={c.dial}>
                        +{c.dial} {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="h-9"
                  inputMode="tel"
                  placeholder="Número"
                  value={national}
                  onChange={(e) => setNational(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Facturación</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={mode === "final_consumer" ? "default" : "outline"}
                  className="h-9 text-xs"
                  onClick={() => setMode("final_consumer")}
                >
                  Consumidor final
                </Button>
                <Button
                  type="button"
                  variant={mode === "with_data" ? "default" : "outline"}
                  className="h-9 text-xs"
                  onClick={() => {
                    setMode("with_data")
                    if (!billingEmail.trim()) setBillingEmail(user?.email || "")
                  }}
                >
                  Con mis datos
                </Button>
              </div>
            </div>

            {mode === "with_data" ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Tipo de identificación</Label>
                  <Select
                    value={idType || undefined}
                    onValueChange={(v) => setIdType(v as BillingIdType)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cedula">Cédula</SelectItem>
                      <SelectItem value="ruc">RUC</SelectItem>
                      <SelectItem value="passport">Pasaporte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Número</Label>
                  <Input
                    className="h-9"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Nombre o razón social</Label>
                  <Input
                    className="h-9"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Correo de facturación</Label>
                  <Input
                    className="h-9"
                    type="email"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Dirección de facturación</Label>
                  <Input
                    className="h-9"
                    value={billingAddress}
                    onChange={(e) => setBillingAddress(e.target.value)}
                  />
                </div>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={loading}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
