"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { api, ApiError } from "@/lib/api-client"
import {
  countryCreditsFromPricing,
  filterNationalCountries,
  nationalCodesFromPricing,
} from "@/lib/national-audience"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AudienceModePicker } from "./audience-mode-picker"
import type { Country, Promotion, PromotionAudienceMode } from "@/types"

interface ProviderAudienceEditorProps {
  promotion: Promotion
  onAudienceChange?: (mode: PromotionAudienceMode, countryId: string | null) => void
}

/**
 * Cambio de audiencia all ↔ country para el proveedor dueño.
 * Los cambios se guardan al instante (no esperan “Guardar cambios”).
 */
export function ProviderAudienceEditor({
  promotion,
  onAudienceChange,
}: ProviderAudienceEditorProps) {
  const { toast } = useToast()
  const [mode, setMode] = useState<PromotionAudienceMode>(
    promotion.audience_mode ?? "all",
  )
  const [countryId, setCountryId] = useState<string | null>(
    promotion.country_id ?? null,
  )
  const [nationalCountries, setNationalCountries] = useState<Country[]>([])
  const [countryCredits, setCountryCredits] = useState(50)
  const [loadingMeta, setLoadingMeta] = useState(true)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingMode, setPendingMode] = useState<PromotionAudienceMode | null>(
    null,
  )
  const [pendingCountryId, setPendingCountryId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoadingMeta(true)
      try {
        const [countries, pricing] = await Promise.all([
          api.lookup.countries(),
          api.credits.locationPricing().catch(() => null),
        ])
        if (cancelled) return
        const codes = nationalCodesFromPricing(pricing)
        const filtered = filterNationalCountries(countries, codes)
        setNationalCountries(filtered)
        setCountryCredits(countryCreditsFromPricing(pricing))
        if (!countryId && filtered.length > 0) {
          setCountryId(filtered[0].id)
        }
      } catch {
        if (!cancelled) setNationalCountries([])
      } finally {
        if (!cancelled) setLoadingMeta(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
    // Solo al montar / cambiar promo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promotion.id])

  function requestModeChange(next: PromotionAudienceMode) {
    if (next === mode || saving) return
    const nextCountry =
      next === "country"
        ? countryId ?? nationalCountries[0]?.id ?? null
        : null
    if (next === "country" && !nextCountry) {
      toast({
        variant: "destructive",
        title: "Sin país disponible",
        description: "No hay países habilitados para audiencia nacional.",
      })
      return
    }
    // Confirmar al entrar a Nacional (borra pines, sin reembolso).
    if (next === "country" && mode !== "country") {
      setPendingMode(next)
      setPendingCountryId(nextCountry)
      setConfirmOpen(true)
      return
    }
    void applyMode(next, nextCountry)
  }

  async function applyMode(
    next: PromotionAudienceMode,
    nextCountryId: string | null,
  ) {
    setSaving(true)
    try {
      const res = await api.promotions.setAudienceMode(
        promotion.id,
        next,
        next === "country" ? nextCountryId : null,
      )
      setMode(res.audience_mode)
      setCountryId(res.country_id ?? null)
      onAudienceChange?.(res.audience_mode, res.country_id ?? null)
      const charged =
        res.credits_charged != null && Number(res.credits_charged) > 0
          ? ` Se descontaron ${res.credits_charged} créditos.`
          : ""
      const pins =
        res.locations_removed && res.locations_removed > 0
          ? ` Se eliminaron ${res.locations_removed} ubicación${res.locations_removed === 1 ? "" : "es"}.`
          : ""
      toast({
        title: "Audiencia actualizada",
        description:
          res.audience_mode === "country"
            ? `Ahora es Nacional.${pins}${charged}`
            : `Ahora la ven los usuarios de la zona según ubicaciones.${pins}`,
      })
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err instanceof ApiError || err instanceof Error
            ? err.message
            : "No se pudo cambiar la audiencia.",
      })
    } finally {
      setSaving(false)
      setConfirmOpen(false)
      setPendingMode(null)
      setPendingCountryId(null)
    }
  }

  function handleCountryChange(nextId: string | null) {
    if (!nextId || nextId === countryId || mode !== "country" || saving) return
    setPendingMode("country")
    setPendingCountryId(nextId)
    setConfirmOpen(true)
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Audiencia</CardTitle>
        <CardDescription className="text-xs">
          Los cambios de esta sección se guardan al instante, sin pulsar
          &quot;Guardar cambios&quot;.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadingMeta ? (
          <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Cargando opciones…
          </p>
        ) : (
          <AudienceModePicker
            isAdmin={false}
            value={mode === "list" ? "all" : mode}
            onChange={requestModeChange}
            countryId={countryId}
            onCountryChange={handleCountryChange}
            nationalCountries={nationalCountries}
            countryCredits={countryCredits}
            disabled={saving}
            options={["all", "country"]}
          />
        )}
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>¿Cambiar a audiencia Nacional?</DialogTitle>
            <DialogDescription>
              Se eliminarán las ubicaciones del mapa y no se reembolsan los
              créditos de pines. El costo de Nacional se cobra al activar (si
              aplica a este tipo de publicación).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setConfirmOpen(false)
                setPendingMode(null)
                setPendingCountryId(null)
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={saving || !pendingMode}
              onClick={() => {
                if (pendingMode) {
                  void applyMode(pendingMode, pendingCountryId)
                }
              }}
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Confirmar Nacional
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
