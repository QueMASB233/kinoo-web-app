"use client"

import { useEffect, useRef, useState } from "react"
import {
  Clock,
  FileVideo,
  Film,
  HardDrive,
  Loader2,
  Scissors,
  Square,
  Upload,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  PROMOTION_VIDEO_MAX_ALLOWED_SECONDS,
  PROMOTION_VIDEO_MAX_BYTES,
  PROMOTION_VIDEO_MAX_DURATION_SECONDS,
  PROMOTION_VIDEO_ONLY_MP4_MESSAGE,
  PROMOTION_VIDEO_SOURCE_ACCEPT,
  formatFileSizeMb,
  formatVideoDuration,
  isMp4File,
} from "@/lib/promotion-video"
import {
  VideoPrepareCanceledError,
  canOptimizeVideosInBrowser,
  preparePromotionVideo,
  probePromotionVideoSource,
  type PromotionVideoEdit,
  type VideoSourceInfo,
} from "@/lib/promotion-video-compress"
import {
  captureVideoThumbnailFile,
  defaultAutoThumbTime,
} from "@/lib/promotion-video-thumbnail"
import { PromotionVideoEditor } from "./promotion-video-editor"

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
  /** Avisa mientras se analiza/optimiza el video, para bloquear el guardado. */
  onBusyChange?: (busy: boolean) => void
  error?: string | null
  disabled?: boolean
}

interface EditorSession {
  file: File
  info: VideoSourceInfo
  initial?: PromotionVideoEdit
}

const PREVIEW_UNAVAILABLE_MESSAGE = `Tu navegador no puede reproducir este video para editarlo (posiblemente usa el códec HEVC). Prueba desde Safari o Chrome actualizados, o recórtalo antes a ${PROMOTION_VIDEO_MAX_DURATION_SECONDS} s.`

const VIDEO_RULES = [
  { icon: Clock, label: `Máximo ${PROMOTION_VIDEO_MAX_DURATION_SECONDS} segundos` },
  { icon: Square, label: "Formato 1:1 recomendado" },
  { icon: HardDrive, label: `Máximo ${PROMOTION_VIDEO_MAX_BYTES / (1024 * 1024)} MB` },
  { icon: FileVideo, label: "Solo archivos MP4" },
] as const

function VideoRules() {
  return (
    <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {VIDEO_RULES.map(({ icon: Icon, label }) => (
        <li
          key={label}
          className="flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5 text-[11px] text-foreground"
        >
          <Icon className="h-3.5 w-3.5 shrink-0 text-violet-600" />
          {label}
        </li>
      ))}
    </ul>
  )
}

function OptimizeProgress({
  progress,
  onCancel,
  className = "",
}: {
  progress: number
  onCancel: () => void
  className?: string
}) {
  const pct = Math.round(progress * 100)
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Optimizando video… {pct}%
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={onCancel}
        >
          Cancelar
        </Button>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-violet-500 transition-[width] duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Lo convertimos a formato cuadrado y liviano para que suba rápido y se
        vea fluido en la app. No cierres esta pestaña.
      </p>
    </div>
  )
}

export function PromotionVideoUpload({
  existingVideoUrl,
  existingDurationSeconds,
  file,
  onFileChange,
  onClearExisting,
  onThumbnailCapture,
  autoCaptureThumbnail = true,
  onBusyChange,
  error,
  disabled = false,
}: PromotionVideoUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const scrubVideoRef = useRef<HTMLVideoElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [localDuration, setLocalDuration] = useState<number | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const [validating, setValidating] = useState(false)
  const [optimizeProgress, setOptimizeProgress] = useState<number | null>(null)
  const [originalBytes, setOriginalBytes] = useState<number | null>(null)
  const [wasOptimized, setWasOptimized] = useState(false)
  const [editor, setEditor] = useState<EditorSession | null>(null)
  const [editorError, setEditorError] = useState<string | null>(null)
  /** Último original editado, para poder volver a ajustar el recorte. */
  const [lastEdit, setLastEdit] = useState<Required<EditorSession> | null>(null)
  const [scrubTime, setScrubTime] = useState(0)
  const [capturing, setCapturing] = useState(false)
  const [thumbHint, setThumbHint] = useState<string | null>(null)

  const optimizing = optimizeProgress != null
  const busy = validating || optimizing || capturing
  const previewSrc = localPreview || existingVideoUrl || null
  const duration = localDuration ?? existingDurationSeconds ?? null
  const videoSourceForCapture: File | string | null =
    file ?? existingVideoUrl ?? null

  useEffect(() => {
    onBusyChange?.(busy)
  }, [busy, onBusyChange])

  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    if (!file) {
      setLocalPreview(null)
      setLocalDuration(null)
      setOriginalBytes(null)
      setWasOptimized(false)
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
          ? `Miniatura automática (~${timeSeconds.toFixed(1)} s). Puedes cambiarla con el control o subir otra imagen abajo.`
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

  function resetInput() {
    if (fileRef.current) fileRef.current.value = ""
  }

  async function prepare(
    source: File,
    options: {
      info?: VideoSourceInfo | null
      edit?: PromotionVideoEdit
      /** Se lanzó desde el modal: los errores se muestran ahí y el editor sigue abierto. */
      fromEditor?: boolean
    } = {},
  ) {
    const controller = new AbortController()
    abortRef.current = controller
    setClientError(null)
    setEditorError(null)
    setOptimizeProgress(0)
    try {
      const prepared = await preparePromotionVideo(source, {
        edit: options.edit,
        signal: controller.signal,
        onProgress: (p) => setOptimizeProgress(p),
      })
      setEditor(null)
      setLastEdit(
        options.info && prepared.optimized
          ? {
              file: source,
              info: options.info,
              initial: options.edit ?? {
                start: 0,
                end: Math.min(
                  options.info.durationSeconds,
                  PROMOTION_VIDEO_MAX_DURATION_SECONDS,
                ),
                pan: { x: 0.5, y: 0.5 },
              },
            }
          : null,
      )
      onFileChange(prepared.file)
      setLocalDuration(prepared.durationSeconds)
      setOriginalBytes(prepared.originalBytes)
      setWasOptimized(prepared.optimized)
      const autoTime = defaultAutoThumbTime(prepared.durationSeconds)
      setScrubTime(autoTime)
      setOptimizeProgress(null)

      if (autoCaptureThumbnail && onThumbnailCapture) {
        await captureAt(autoTime, { auto: true, source: prepared.file })
      }
    } catch (err) {
      if (!(err instanceof VideoPrepareCanceledError)) {
        const message =
          err instanceof Error
            ? err.message
            : "No se pudo procesar el video. Intenta con otro archivo."
        if (options.fromEditor) {
          setEditorError(message)
        } else {
          setClientError(message)
          setEditor(null)
        }
      }
      resetInput()
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setOptimizeProgress(null)
    }
  }

  async function handleFileChange(nextFile: File | null) {
    if (!nextFile) return

    setThumbHint(null)
    setEditor(null)
    setEditorError(null)
    if (!isMp4File(nextFile)) {
      setClientError(PROMOTION_VIDEO_ONLY_MP4_MESSAGE)
      resetInput()
      return
    }

    setValidating(true)
    setClientError(null)
    let info: VideoSourceInfo | null = null
    try {
      info = await probePromotionVideoSource(nextFile)
    } finally {
      setValidating(false)
    }

    if (info && canOptimizeVideosInBrowser()) {
      setEditor({ file: nextFile, info })
      resetInput()
      return
    }
    if (info && info.durationSeconds > PROMOTION_VIDEO_MAX_ALLOWED_SECONDS) {
      setClientError(
        `El video dura ${formatVideoDuration(info.durationSeconds)} y el máximo es ${PROMOTION_VIDEO_MAX_DURATION_SECONDS} s. Tu navegador no permite recortarlo aquí: recórtalo antes de subirlo o usa Chrome, Edge o Safari actualizados.`,
      )
      resetInput()
      return
    }

    await prepare(nextFile, { info })
  }

  function handleEditorConfirm(edit: PromotionVideoEdit) {
    const session = editor
    if (!session) return
    setEditor({ ...session, initial: edit })
    void prepare(session.file, { info: session.info, edit, fromEditor: true })
  }

  function handleEditorOpenChange(open: boolean) {
    if (open) return
    if (optimizing) {
      abortRef.current?.abort()
      return
    }
    setEditor(null)
    setEditorError(null)
  }

  function handleEditorPreviewError() {
    const session = editor
    setEditor(null)
    setEditorError(null)
    if (
      session &&
      session.info.durationSeconds <= PROMOTION_VIDEO_MAX_ALLOWED_SECONDS
    ) {
      void prepare(session.file, { info: session.info })
      return
    }
    setClientError(PREVIEW_UNAVAILABLE_MESSAGE)
  }

  function handleCancelOptimize() {
    abortRef.current?.abort()
  }

  function handleRemove() {
    abortRef.current?.abort()
    onFileChange(null)
    onClearExisting?.()
    setEditor(null)
    setEditorError(null)
    setLastEdit(null)
    setLocalDuration(null)
    setClientError(null)
    setThumbHint(null)
    setScrubTime(0)
    resetInput()
  }

  const displayError = error || clientError
  const durationLabel = formatVideoDuration(duration ?? Number.NaN)
  const sizeLabel = file ? formatFileSizeMb(file.size) : null
  const maxScrub = duration && duration > 0 ? duration : PROMOTION_VIDEO_MAX_DURATION_SECONDS
  const controlsDisabled = disabled || busy

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">Video de la publicación (opcional)</Label>
      <VideoRules />
      <input
        ref={fileRef}
        type="file"
        accept={PROMOTION_VIDEO_SOURCE_ACCEPT}
        className="hidden"
        disabled={controlsDisabled}
        onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
      />

      <Dialog open={editor != null} onOpenChange={handleEditorOpenChange}>
        <DialogContent
          className="max-h-[92vh] overflow-y-auto sm:max-w-xl"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{optimizing ? "Preparando tu video" : "Edita tu video"}</DialogTitle>
            <DialogDescription>
              {optimizing
                ? "Tarda unos segundos."
                : `Elige hasta ${PROMOTION_VIDEO_MAX_DURATION_SECONDS} segundos.`}
            </DialogDescription>
          </DialogHeader>
          {editor ? (
            optimizing ? (
              <OptimizeProgress
                progress={optimizeProgress ?? 0}
                onCancel={handleCancelOptimize}
                className="rounded-md border border-border/60 bg-muted/30 p-3"
              />
            ) : (
              <PromotionVideoEditor
                key={`${editor.file.name}-${editor.file.size}-${editor.file.lastModified}`}
                file={editor.file}
                info={editor.info}
                initial={editor.initial}
                disabled={disabled}
                onConfirm={handleEditorConfirm}
                onCancel={() => handleEditorOpenChange(false)}
                onPreviewError={handleEditorPreviewError}
              />
            )
          ) : null}
          {editorError && !optimizing ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {editorError}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>

      {optimizing && !editor ? (
        <OptimizeProgress
          progress={optimizeProgress ?? 0}
          onCancel={handleCancelOptimize}
          className="max-w-sm rounded-md border border-border/60 bg-muted/30 p-3"
        />
      ) : previewSrc ? (
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
            {sizeLabel ? (
              <span>
                {sizeLabel}
                {wasOptimized && originalBytes != null && originalBytes > (file?.size ?? 0)
                  ? ` (original ${formatFileSizeMb(originalBytes)})`
                  : ""}
              </span>
            ) : null}
            {file ? (
              <span>
                {wasOptimized ? "Optimizado, listo para subir" : "Listo para subir"}
              </span>
            ) : null}
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
                  disabled={controlsDisabled}
                  onChange={(e) => setScrubTime(Number(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={controlsDisabled}
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
                  disabled={controlsDisabled || duration == null}
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
            {file && lastEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={controlsDisabled}
                onClick={() => {
                  setEditorError(null)
                  setEditor(lastEdit)
                }}
              >
                <Scissors className="mr-2 h-4 w-4" />
                Editar recorte
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={controlsDisabled}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Cambiar video
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={controlsDisabled}
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
          disabled={controlsDisabled}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4 shrink-0" />
          <span className="text-sm">
            {validating ? "Analizando video…" : "Seleccionar video MP4"}
          </span>
        </Button>
      )}

      {displayError ? (
        <p className="text-xs text-destructive">{displayError}</p>
      ) : validating || capturing ? (
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          {capturing ? "Generando miniatura…" : "Analizando video…"}
        </p>
      ) : null}
    </div>
  )
}
