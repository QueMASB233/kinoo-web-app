import { optimizePromotionImageFile } from "@/lib/optimize-promotion-image"

/** Segundo por defecto para miniatura automática (primeros segundos). */
export const PROMOTION_VIDEO_AUTO_THUMB_SECONDS = 1

function loadVideoElement(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video")
    video.preload = "auto"
    video.muted = true
    video.playsInline = true
    video.crossOrigin = "anonymous"

    const cleanup = () => {
      video.onloadeddata = null
      video.onerror = null
    }

    video.onloadeddata = () => {
      cleanup()
      resolve(video)
    }
    video.onerror = () => {
      cleanup()
      reject(new Error("No se pudo cargar el video para la miniatura."))
    }
    video.src = src
  })
}

function seekVideo(video: HTMLVideoElement, timeSeconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const duration = Number.isFinite(video.duration) ? video.duration : 0
    const target =
      duration > 0
        ? Math.min(Math.max(0, timeSeconds), Math.max(0, duration - 0.05))
        : Math.max(0, timeSeconds)

    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked)
      resolve()
    }
    const onError = () => {
      video.removeEventListener("seeked", onSeeked)
      video.removeEventListener("error", onError)
      reject(new Error("No se pudo posicionar el video para la miniatura."))
    }

    video.addEventListener("seeked", onSeeked)
    video.addEventListener("error", onError)

    if (Math.abs(video.currentTime - target) < 0.01) {
      video.removeEventListener("seeked", onSeeked)
      video.removeEventListener("error", onError)
      resolve()
      return
    }
    video.currentTime = target
  })
}

function canvasToJpegBlob(
  video: HTMLVideoElement,
  quality = 0.9,
): Promise<Blob> {
  const width = video.videoWidth || 720
  const height = video.videoHeight || 720
  if (width < 1 || height < 1) {
    return Promise.reject(new Error("Frame de video inválido."))
  }

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) {
    return Promise.reject(new Error("No se pudo crear la miniatura."))
  }
  ctx.drawImage(video, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo generar la miniatura JPEG."))
          return
        }
        resolve(blob)
      },
      "image/jpeg",
      quality,
    )
  })
}

/**
 * Extrae un fotograma del video (File o URL) en `timeSeconds`,
 * lo optimiza como portada de publicación y devuelve un File JPEG.
 */
export async function captureVideoThumbnailFile(
  source: File | string,
  timeSeconds: number = PROMOTION_VIDEO_AUTO_THUMB_SECONDS,
): Promise<File> {
  const objectUrl =
    typeof source === "string" ? null : URL.createObjectURL(source)
  const src = typeof source === "string" ? source : objectUrl!

  try {
    const video = await loadVideoElement(src)
    try {
      await seekVideo(video, timeSeconds)
      // Algunos navegadores pintan el frame un tick después del seeked.
      await new Promise((r) => requestAnimationFrame(() => r(undefined)))
      const blob = await canvasToJpegBlob(video)
      const raw = new File([blob], "miniatura-video.jpg", {
        type: "image/jpeg",
      })
      return await optimizePromotionImageFile(raw)
    } finally {
      video.removeAttribute("src")
      video.load()
    }
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}

export function defaultAutoThumbTime(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return PROMOTION_VIDEO_AUTO_THUMB_SECONDS
  }
  // ~1 s, o la mitad si el video es más corto.
  return Math.min(PROMOTION_VIDEO_AUTO_THUMB_SECONDS, durationSeconds * 0.5)
}
