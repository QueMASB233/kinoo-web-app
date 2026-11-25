import type { AdCreditLocationPricing, Country } from "@/types"

/** Fallback si el API de pricing no está disponible (p.ej. sesión admin). */
export const DEFAULT_NATIONAL_COUNTRY_CODES = ["EC"]
export const DEFAULT_COUNTRY_CREDITS = 50

export function nationalCodesFromPricing(
  pricing: AdCreditLocationPricing | null | undefined,
): string[] {
  const codes = pricing?.national_country_codes
  if (Array.isArray(codes) && codes.length > 0) {
    return codes.map((c) => String(c).trim().toUpperCase()).filter(Boolean)
  }
  return [...DEFAULT_NATIONAL_COUNTRY_CODES]
}

export function countryCreditsFromPricing(
  pricing: AdCreditLocationPricing | null | undefined,
): number {
  const raw = pricing?.country_credits
  if (raw == null || raw === "") return DEFAULT_COUNTRY_CREDITS
  const n = Number(raw)
  return Number.isFinite(n) ? n : DEFAULT_COUNTRY_CREDITS
}

export function filterNationalCountries(
  countries: Country[],
  codes: string[],
): Country[] {
  const allowed = new Set(codes.map((c) => c.toUpperCase()))
  return countries.filter((c) => {
    const code = (c.code || "").toUpperCase()
    return code && allowed.has(code)
  })
}

export function audienceModeHint(
  mode: "all" | "list" | "country",
  opts: { isAdmin: boolean; countryCredits: number },
): string {
  if (mode === "list") {
    return "Solo la ven los usuarios del CSV, estén donde estén. Las ubicaciones son opcionales."
  }
  if (mode === "country") {
    if (opts.isAdmin) {
      return "La ven los usuarios con ese país en su perfil. Sin pines ni mapa."
    }
    return `La ven los usuarios con ese país en su perfil. Costo: ${opts.countryCredits} créditos al activar (sin pines).`
  }
  return "La ven los usuarios cerca de sus ubicaciones, con la segmentación que elijas."
}
