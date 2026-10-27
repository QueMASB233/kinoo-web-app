/** Teléfono E.164 alineado con backend / app móvil. */

export type DialCodeOption = {
  dial: string
  iso: string
  label: string
}

export const DIAL_CODES: DialCodeOption[] = [
  { dial: "593", iso: "EC", label: "Ecuador" },
  { dial: "57", iso: "CO", label: "Colombia" },
  { dial: "51", iso: "PE", label: "Perú" },
  { dial: "52", iso: "MX", label: "México" },
  { dial: "54", iso: "AR", label: "Argentina" },
  { dial: "56", iso: "CL", label: "Chile" },
  { dial: "58", iso: "VE", label: "Venezuela" },
  { dial: "1", iso: "US", label: "Estados Unidos / Canadá" },
  { dial: "34", iso: "ES", label: "España" },
  { dial: "55", iso: "BR", label: "Brasil" },
]

export const DEFAULT_DIAL = "593"

const E164_RE = /^\+[1-9]\d{6,14}$/

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "")
}

export function splitPhoneE164(
  e164: string | null | undefined,
): { dial: string; national: string } {
  const raw = (e164 || "").trim().replace(/\s+/g, "")
  if (!raw.startsWith("+")) {
    return { dial: DEFAULT_DIAL, national: digitsOnly(raw) }
  }
  const rest = raw.slice(1)
  const sorted = [...DIAL_CODES].sort((a, b) => b.dial.length - a.dial.length)
  for (const c of sorted) {
    if (rest.startsWith(c.dial)) {
      return { dial: c.dial, national: rest.slice(c.dial.length) }
    }
  }
  return { dial: DEFAULT_DIAL, national: rest }
}

export function toE164(dial: string, national: string): string | null {
  const d = digitsOnly(dial)
  const n = digitsOnly(national)
  if (!n) return null
  return `+${d}${n}`
}

export function isValidE164(value: string | null | undefined): boolean {
  if (!value) return false
  return E164_RE.test(value.trim())
}

export function validatePhoneParts(
  dial: string,
  national: string,
  opts?: { required?: boolean },
): { ok: true; e164: string | null } | { ok: false; error: "required" | "invalid" } {
  const e164 = toE164(dial, national)
  if (!e164) {
    if (opts?.required) return { ok: false, error: "required" }
    return { ok: true, e164: null }
  }
  if (!isValidE164(e164)) return { ok: false, error: "invalid" }
  return { ok: true, e164 }
}
