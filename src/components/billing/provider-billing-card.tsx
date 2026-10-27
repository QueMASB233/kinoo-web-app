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
import type { BillingIdType, BillingMode } from "@/types"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { Separator } from "@/components/ui/separator"
import { Loader2 } from "lucide-react"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CEDULA_RE = /^\d{10}$/
const RUC_RE = /^\d{13}$/
const PASSPORT_RE = /^[A-Za-z0-9]{5,20}$/

export function ProviderBillingCard() {
  const { user, refreshUser } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [savingPhone, setSavingPhone] = useState(false)
  const [savingBilling, setSavingBilling] = useState(false)
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
        title: "Error",
        description:
          err instanceof ApiError
            ? err.message
            : "No se pudo cargar facturación.",
      })
    } finally {
      setLoading(false)
    }
  }, [toast, user?.email, user?.phone_e164])

  useEffect(() => {
    void load()
  }, [load])

  async function savePhone() {
    const result = validatePhoneParts(dial, national, { required: false })
    if (!result.ok) {
      toast({
        variant: "destructive",
        title: "Teléfono inválido",
        description: "Usa un teléfono válido con código de país.",
      })
      return
    }
    setSavingPhone(true)
    try {
      await api.users.updateProfile({ phone_e164: result.e164 })
      await refreshUser()
      toast({
        title: "Teléfono guardado",
        description: "Se usará al comprar créditos.",
      })
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err instanceof ApiError ? err.message : "No se pudo guardar.",
      })
    } finally {
      setSavingPhone(false)
    }
  }

  async function saveBilling() {
    setSavingBilling(true)
    try {
      if (mode === "final_consumer") {
        await api.users.upsertBilling({ mode: "final_consumer" })
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
            description: "Ingresa un correo válido.",
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
        await api.users.upsertBilling({
          mode: "with_data",
          id_type: idType,
          id_number: num,
          legal_name: legalName.trim(),
          billing_email: email,
          billing_address_line: billingAddress.trim(),
        })
      }
      toast({
        title: "Facturación guardada",
        description: "Se usará al comprar créditos.",
      })
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err instanceof ApiError ? err.message : "No se pudo guardar.",
      })
    } finally {
      setSavingBilling(false)
    }
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">
          Teléfono y facturación
        </CardTitle>
        <CardDescription className="text-xs">
          Obligatorios antes de comprar créditos. También puedes
          confirmarlos o actualizarlos en el checkout; al pagar se guardan aquí.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Teléfono</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select value={dial} onValueChange={setDial}>
                  <SelectTrigger className="h-9 w-full sm:w-[160px]">
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
              <Button
                type="button"
                size="sm"
                onClick={() => void savePhone()}
                disabled={savingPhone}
              >
                {savingPhone ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Guardar teléfono
              </Button>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-xs font-medium">Modo de facturación</Label>
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

            <Button
              type="button"
              onClick={() => void saveBilling()}
              disabled={savingBilling}
            >
              {savingBilling ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Guardar facturación
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
