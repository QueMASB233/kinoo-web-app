/**
 * Radios de cobertura (metros). Deben coincidir con POINT_COVERAGE_RADIUS_M / CITY_COVERAGE_RADIUS_M
 * del backend (appet/backend/app/core/config.py). Next.js los inyecta en build: cambiarlos requiere rebuild.
 */
function readRadius(raw: string | undefined, fallback: number): number {
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export const POINT_COVERAGE_RADIUS_M = readRadius(
  process.env.NEXT_PUBLIC_POINT_COVERAGE_RADIUS_M,
  2000
)
export const CITY_COVERAGE_RADIUS_M = readRadius(
  process.env.NEXT_PUBLIC_CITY_COVERAGE_RADIUS_M,
  25000
)

/** 2000 → "2 km", 1500 → "1.5 km", 800 → "800 m" */
export function formatRadius(meters: number): string {
  if (meters < 1000) return `${meters} m`
  const km = meters / 1000
  return `${Number.isInteger(km) ? km : km.toFixed(1)} km`
}

export const POINT_COVERAGE_LABEL = formatRadius(POINT_COVERAGE_RADIUS_M)
export const CITY_COVERAGE_LABEL = formatRadius(CITY_COVERAGE_RADIUS_M)
