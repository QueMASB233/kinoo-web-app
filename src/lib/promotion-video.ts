/** Límites de video de publicaciones — alineados al backend / bucket promo-videos. */

export const PROMOTION_VIDEO_MAX_BYTES = 20 * 1024 * 1024
export const PROMOTION_VIDEO_MAX_DURATION_SECONDS = 15
/** Margen por redondeo del encoder (igual que backend). */
export const PROMOTION_VIDEO_DURATION_TOLERANCE_SECONDS = 0.5
export const PROMOTION_VIDEO_ALLOWED_MIME = "video/mp4" as const
export const PROMOTION_VIDEO_UPLOAD_TIMEOUT_MS = 180_000

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

/**
 * Lee la duración del MP4 en el navegador (metadata).
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

export async function validatePromotionVideoFile(
  file: File,
): Promise<{ durationSeconds: number }> {
  const mime = (file.type || "").toLowerCase()
  if (mime && mime !== PROMOTION_VIDEO_ALLOWED_MIME && mime !== "application/mp4") {
    throw new Error("Usa un video MP4 (H.264).")
  }
  // Algunos sistemas dejan type vacío; igual intentamos leer metadata.
  if (!mime && !file.name.toLowerCase().endsWith(".mp4")) {
    throw new Error("Usa un video MP4 (H.264).")
  }

  if (file.size > PROMOTION_VIDEO_MAX_BYTES) {
    throw new Error(
      `El video no puede superar ${PROMOTION_VIDEO_MAX_BYTES / (1024 * 1024)} MB.`,
    )
  }

  if (file.size < 32) {
    throw new Error("Archivo de video inválido.")
  }

  const durationSeconds = await readVideoDurationSeconds(file)
  const maxAllowed =
    PROMOTION_VIDEO_MAX_DURATION_SECONDS +
    PROMOTION_VIDEO_DURATION_TOLERANCE_SECONDS

  if (durationSeconds > maxAllowed) {
    throw new Error(
      `El video no puede durar más de ${PROMOTION_VIDEO_MAX_DURATION_SECONDS} segundos (detectado: ${durationSeconds.toFixed(1)} s).`,
    )
  }

  return { durationSeconds }
}
