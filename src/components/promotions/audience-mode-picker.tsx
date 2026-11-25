"use client"

import { PROMOTION_AUDIENCE_MODE_LABELS } from "@/lib/constants"
import { audienceModeHint } from "@/lib/national-audience"
import { Label } from "@/components/ui/label"
import type { Country, PromotionAudienceMode } from "@/types"

interface AudienceModePickerProps {
  isAdmin: boolean
  value: PromotionAudienceMode
  onChange: (mode: PromotionAudienceMode) => void
  countryId: string | null
  onCountryChange: (countryId: string | null) => void
  nationalCountries: Country[]
  countryCredits: number
  disabled?: boolean
  /** Modos disponibles. Admin: all|list|country. Provider: all|country. */
  options?: PromotionAudienceMode[]
}

export function AudienceModePicker({
  isAdmin,
  value,
  onChange,
  countryId,
  onCountryChange,
  nationalCountries,
  countryCredits,
  disabled = false,
  options,
}: AudienceModePickerProps) {
  const modes: PromotionAudienceMode[] =
    options ?? (isAdmin ? ["all", "list", "country"] : ["all", "country"])

  return (
    <div className="space-y-3">
      <Label className="text-xs font-medium">Audiencia</Label>
      <div
        className={`grid gap-2 ${
          modes.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"
        }`}
      >
        {modes.map((option) => (
          <button
            key={option}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option)}
            className={`rounded-lg border-2 p-3 text-left transition-colors disabled:opacity-60 ${
              value === option
                ? "border-foreground bg-muted/50"
                : "border-border hover:border-muted-foreground/30"
            }`}
          >
            <p className="text-sm font-medium">
              {PROMOTION_AUDIENCE_MODE_LABELS[option]}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {audienceModeHint(option, { isAdmin, countryCredits })}
            </p>
          </button>
        ))}
      </div>

      {value === "list" && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Nadie verá esta publicación hasta que cargues la lista de usuarios.
          Después de publicarla podrás subir el CSV.
        </p>
      )}

      {value === "country" && (
        <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
          <Label htmlFor="national-country" className="text-xs font-medium">
            País
          </Label>
          {nationalCountries.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No hay países habilitados para audiencia nacional.
            </p>
          ) : (
            <select
              id="national-country"
              disabled={disabled || nationalCountries.length === 1}
              value={countryId ?? ""}
              onChange={(e) =>
                onCountryChange(e.target.value ? e.target.value : null)
              }
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
            >
              {nationalCountries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.code ? ` (${c.code})` : ""}
                </option>
              ))}
            </select>
          )}
          <p className="text-xs text-muted-foreground">
            {isAdmin
              ? "Sin costo de créditos. No se usan pines en el mapa."
              : `Se descontarán ${countryCredits} créditos al crear o activar Nacional. No se usan pines.`}
          </p>
        </div>
      )}
    </div>
  )
}
