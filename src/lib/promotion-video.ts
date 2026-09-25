/** Límites de video de publicaciones — alineados al backend / bucket promo-videos. */

/** Tope del archivo que se sube (ya optimizado). Igual al bucket y al backend. */
export const PROMOTION_VIDEO_MAX_BYTES = 50 * 1024 * 1024
export const PROMOTION_VIDEO_MAX_DURATION_SECONDS = 30
/** Margen por redondeo del encoder (igual que backend). */
export const PROMOTION_VIDEO_DURATION_TOLERANCE_SECONDS = 1
export const PROMOTION_VIDEO_ALLOWED_MIME = "video/mp4" as const
/** Sin optimizar pueden viajar hasta 50 MB; en redes lentas eso pasa de 3 min. */
export const PROMOTION_VIDEO_UPLOAD_TIMEOUT_MS = 300_000

/** Tope del archivo original que el proveedor elige (se comprime en el navegador). */
export const PROMOTION_VIDEO_SOURCE_MAX_BYTES = 1024 * 1024 * 1024
export const PROMOTION_VIDEO_SOURCE_ACCEPT = "video/mp4,.mp4"
export const PROMOTION_VIDEO_ONLY_MP4_MESSAGE = "Solo se permiten videos en formato MP4."

export const PROMOTION_VIDEO_MAX_ALLOWED_SECONDS =
  PROMOTION_VIDEO_MAX_DURATION_SECONDS + PROMOTION_VIDEO_DURATION_TOLERANCE_SECONDS

export function formatVideoDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—"
  const total = Math.round(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}

export function formatFileSizeMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isMp4File(file: File): boolean {
  const mime = (file.type || "").toLowerCase()
  if (mime === PROMOTION_VIDEO_ALLOWED_MIME || mime === "application/mp4") return true
  return !mime && file.name.toLowerCase().endsWith(".mp4")
}

/**
 * Lee la duración del video en el navegador (metadata).
 */
export function readVideoDurationSeconds(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement("video")
    video.preload = "metadata"
    video.muted = true
    video.playsInline = true

    const cleanup = () => {
      URL.revokeObjectURL(url)
      video.removeAttribute("src")
      video.load()
    }

    video.onloadedmetadata = () => {
      const duration = video.duration
      cleanup()
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("No se pudo determinar la duración del video."))
        return
      }
      resolve(duration)
    }

    video.onerror = () => {
      cleanup()
      reject(new Error("No se pudo leer el video. Usa un MP4 válido."))
    }

    video.src = url
  })
}

/**
 * Valida un archivo listo para subir sin optimizar (fallback cuando el navegador
 * no puede comprimir): MP4, ≤ 50 MB, ≤ 30 s.
 */
export async function validatePromotionVideoFile(
  file: File,
): Promise<{ durationSeconds: number }> {
  if (!isMp4File(file)) {
    throw new Error(PROMOTION_VIDEO_ONLY_MP4_MESSAGE)
  }

  if (file.size > PROMOTION_VIDEO_MAX_BYTES) {
    throw new Error(
      `Tu navegador no puede optimizar este video y pesa ${formatFileSizeMb(file.size)} (máx. ${PROMOTION_VIDEO_MAX_BYTES / (1024 * 1024)} MB sin optimizar). Prueba desde Chrome, Edge o Safari actualizados.`,
    )
  }

  if (file.size < 32) {
    throw new Error("Archivo de video inválido.")
  }

  const durationSeconds = await readVideoDurationSeconds(file)
  if (durationSeconds > PROMOTION_VIDEO_MAX_ALLOWED_SECONDS) {
    throw new Error(
      `El video no puede durar más de ${PROMOTION_VIDEO_MAX_DURATION_SECONDS} segundos (detectado: ${durationSeconds.toFixed(1)} s).`,
    )
  }

  return { durationSeconds }
}
