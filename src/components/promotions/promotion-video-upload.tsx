"use client"

import { useEffect, useRef, useState } from "react"
import { Film, Loader2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  PROMOTION_VIDEO_ALLOWED_MIME,
  PROMOTION_VIDEO_MAX_BYTES,
  PROMOTION_VIDEO_MAX_DURATION_SECONDS,
  formatFileSizeMb,
  formatVideoDuration,
  validatePromotionVideoFile,
} from "@/lib/promotion-video"
import {
  captureVideoThumbnailFile,
  defaultAutoThumbTime,
} from "@/lib/promotion-video-thumbnail"

interface PromotionVideoUploadProps {
  existingVideoUrl?: string | null
  existingDurationSeconds?: number | null
  file: File | null
  onFileChange: (file: File | null) => void
  onClearExisting?: () => void
  /**
   * Cuando el proveedor elige o se auto-genera un fotograma como miniatura.
   * El form lo manda como `photo` (image_url).
   */
  onThumbnailCapture?: (file: File, meta: { auto: boolean; timeSeconds: number }) => void
  /** Si true, al cargar un video nuevo se genera miniatura ~1 s automáticamente. */
  autoCaptureThumbnail?: boolean
  error?: string | null
  disabled?: boolean
}

export function PromotionVideoUpload({
  existingVideoUrl,
  existingDurationSeconds,
  file,
  onFileChange,
  onClearExisting,
  onThumbnailCapture,
  autoCaptureThumbnail = true,
  error,
  disabled = false,
}: PromotionVideoUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const scrubVideoRef = useRef<HTMLVideoElement>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [localDuration, setLocalDuration] = useState<number | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const [validating, setValidating] = useState(false)
  const [scrubTime, setScrubTime] = useState(0)
  const [capturing, setCapturing] = useState(false)
  const [thumbHint, setThumbHint] = useState<string | null>(null)

  const previewSrc = localPreview || existingVideoUrl || null
  const duration = localDuration ?? existingDurationSeconds ?? null
  const videoSourceForCapture: File | string | null =
    file ?? existingVideoUrl ?? null

  useEffect(() => {
    if (!file) {
      setLocalPreview(null)
      setLocalDuration(null)
      return
    }

    const preview = URL.createObjectURL(file)
    setLocalPreview(preview)
    return () => URL.revokeObjectURL(preview)
  }, [file])

  useEffect(() => {
    const video = scrubVideoRef.current
    if (!video || !previewSrc) return
    if (Math.abs(video.currentTime - scrubTime) > 0.05) {
      video.currentTime = scrubTime
    }
  }, [scrubTime, previewSrc])

  async function captureAt(
    timeSeconds: number,
    options: { auto: boolean; source: File | string },
  ) {
    if (!onThumbnailCapture) return
    setCapturing(true)
    setClientError(null)
    try {
      const thumb = await captureVideoThumbnailFile(
        options.source,
        timeSeconds,
      )
      onThumbnailCapture(thumb, {
        auto: options.auto,
        timeSeconds,
      })
      setThumbHint(
        options.auto
          ? `Miniatura automática (~${timeSeconds.toFixed(1)} s). Puedes cambiarla con el control o subir otra imagen arriba.`
          : `Miniatura tomada en ${formatVideoDuration(timeSeconds)}.`,
      )
    } catch (err) {
      setClientError(
        err instanceof Error
          ? err.message
          : "No se pudo generar la miniatura del video.",
      )
    } finally {
      setCapturing(false)
    }
  }

  async function handleFileChange(nextFile: File | null) {
    if (!nextFile) return

    setValidating(true)
    setClientError(null)
    setThumbHint(null)
    try {
      const { durationSeconds } = await validatePromotionVideoFile(nextFile)
      setLocalDuration(durationSeconds)
      const autoTime = defaultAutoThumbTime(durationSeconds)
      setScrubTime(autoTime)
      onFileChange(nextFile)

      if (autoCaptureThumbnail && onThumbnailCapture) {
        await captureAt(autoTime, { auto: true, source: nextFile })
      }
    } catch (err) {
      setClientError(
        err instanceof Error
          ? err.message
          : "No se pudo validar el video. Intenta con otro archivo.",
      )
      setLocalDuration(null)
      onFileChange(null)
      if (fileRef.current) fileRef.current.value = ""
    } finally {
      setValidating(false)
    }
  }

  function handleRemove() {
    onFileChange(null)
    onClearExisting?.()
    setLocalDuration(null)
    setClientError(null)
    setThumbHint(null)
    setScrubTime(0)
    if (fileRef.current) fileRef.current.value = ""
  }

  const displayError = error || clientError
  const durationLabel = formatVideoDuration(duration ?? Number.NaN)
  const sizeLabel = file ? formatFileSizeMb(file.size) : null
  const maxScrub = duration && duration > 0 ? duration : PROMOTION_VIDEO_MAX_DURATION_SECONDS

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">Video de la publicación (opcional)</Label>
      <input
        ref={fileRef}
        type="file"
        accept={`${PROMOTION_VIDEO_ALLOWED_MIME},.mp4`}
        className="hidden"
        disabled={disabled || validating || capturing}
        onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
      />

      {previewSrc ? (
        <div className="space-y-3">
          <div className="relative w-full max-w-sm aspect-square overflow-hidden rounded-md border border-border/60 bg-black">
            <video
              ref={scrubVideoRef}
              src={previewSrc}
              className="h-full w-full object-cover"
              controls
              playsInline
              preload="metadata"
              muted
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration
                if (Number.isFinite(d) && d > 0 && localDuration == null) {
                  setLocalDuration(d)
                  if (scrubTime <= 0) {
                    setScrubTime(defaultAutoThumbTime(d))
                  }
                }
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Film className="h-3.5 w-3.5" />
              Duración {durationLabel}
            </span>
            {sizeLabel ? <span>{sizeLabel}</span> : null}
            {file ? <span>Nuevo archivo listo para subir</span> : null}
          </div>

          {onThumbnailCapture && videoSourceForCapture ? (
            <div className="max-w-sm space-y-2 rounded-md border border-border/60 bg-muted/30 p-3">
              <p className="text-xs font-medium text-foreground">
                Miniatura del video
              </p>
              <p className="text-[11px] text-muted-foreground">
                Obligatoria. Si no eliges un fotograma, usamos ~1 s
                automáticamente. También puedes subir otra imagen abajo.
              </p>
              <div className="space-y-1">
                <Label htmlFor="video-thumb-scrub" className="text-[11px]">
                  Fotograma en {formatVideoDuration(scrubTime)}
                </Label>
                <input
                  id="video-thumb-scrub"
                  type="range"
                  min={0}
                  max={maxScrub}
                  step={0.1}
                  value={Math.min(scrubTime, maxScrub)}
                  disabled={disabled || validating || capturing}
                  onChange={(e) => setScrubTime(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || validating || capturing}
                  onClick={() =>
                    void captureAt(scrubTime, {
                      auto: false,
                      source: videoSourceForCapture,
                    })
                  }
                >
                  {capturing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Usar este fotograma
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled || validating || capturing || duration == null}
                  onClick={() => {
                    if (duration == null) return
                    const t = defaultAutoThumbTime(duration)
                    setScrubTime(t)
                    void captureAt(t, {
                      auto: true,
                      source: videoSourceForCapture,
                    })
                  }}
                >
                  Auto (~1 s)
                </Button>
              </div>
              {thumbHint ? (
                <p className="text-[11px] text-muted-foreground">{thumbHint}</p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || validating || capturing}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Cambiar video
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || validating || capturing}
              onClick={handleRemove}
            >
              <X className="mr-2 h-4 w-4" />
              Quitar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-auto w-full justify-start gap-2 py-3"
          disabled={disabled || validating || capturing}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4 shrink-0" />
          <span className="text-sm">
            {validating
              ? "Validando video…"
              : `Seleccionar video (MP4, máx. ${PROMOTION_VIDEO_MAX_DURATION_SECONDS} s / ${PROMOTION_VIDEO_MAX_BYTES / (1024 * 1024)} MB)`}
          </span>
        </Button>
      )}

      {displayError ? (
        <p className="text-xs text-destructive">{displayError}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {validating || capturing ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              {capturing
                ? "Generando miniatura…"
                : "Comprobando duración y tamaño…"}
            </span>
          ) : (
            <>
              Opcional. Formato cuadrado 1:1 recomendado, máx.{" "}
              {PROMOTION_VIDEO_MAX_DURATION_SECONDS} s, MP4. El video lo revisa un
              admin manualmente (no tiene moderación automática como la imagen).
            </>
          )}
        </p>
      )}
    </div>
  )
}
