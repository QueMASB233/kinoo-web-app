"use client"

import { useEffect, useRef, useState } from "react"
import type { PointerEvent as ReactPointerEvent } from "react"
import { Move, Pause, Play, Scissors, Volume2, VolumeX } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  PROMOTION_VIDEO_MAX_DURATION_SECONDS,
  formatVideoDuration,
} from "@/lib/promotion-video"
import {
  generatePromotionVideoFilmstrip,
  type PromotionVideoEdit,
  type VideoFramingPan,
  type VideoSourceInfo,
} from "@/lib/promotion-video-compress"

const MIN_CLIP_SECONDS = 1
const FILMSTRIP_FRAMES = 10
/** Movimiento mínimo (px) para considerar arrastre y no un toque de play/pausa. */
const DRAG_THRESHOLD_PX = 4

type TimelineDragMode = "start" | "end" | "window"

interface TimelineDrag {
  mode: TimelineDragMode
  originT: number
  originStart: number
  originEnd: number
}

interface PanDrag {
  clientX: number
  clientY: number
  origin: VideoFramingPan
  moved: boolean
}

interface PromotionVideoEditorProps {
  file: File
  info: VideoSourceInfo
  initial?: PromotionVideoEdit
  disabled?: boolean
  onConfirm: (edit: PromotionVideoEdit) => void
  onCancel: () => void
  /** El navegador no puede reproducir el archivo (p. ej. HEVC sin soporte). */
  onPreviewError?: () => void
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function formatPrecise(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds - m * 60
  return `${m}:${s.toFixed(1).padStart(4, "0")}`
}

export function PromotionVideoEditor({
  file,
  info,
  initial,
  disabled = false,
  onConfirm,
  onCancel,
  onPreviewError,
}: PromotionVideoEditorProps) {
  const duration = info.durationSeconds
  const videoRef = useRef<HTMLVideoElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const timelineDragRef = useRef<TimelineDrag | null>(null)
  const panDragRef = useRef<PanDrag | null>(null)

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(
    info.width && info.height ? { w: info.width, h: info.height } : null,
  )
  const [start, setStart] = useState(initial?.start ?? 0)
  const [end, setEnd] = useState(
    initial?.end ?? Math.min(duration, PROMOTION_VIDEO_MAX_DURATION_SECONDS),
  )
  const [pan, setPan] = useState<VideoFramingPan>(initial?.pan ?? { x: 0.5, y: 0.5 })
  const [playhead, setPlayhead] = useState(initial?.start ?? 0)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [panning, setPanning] = useState(false)
  const [frames, setFrames] = useState<string[]>([])

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  useEffect(() => {
    let cancelled = false
    setFrames([])
    void generatePromotionVideoFilmstrip(file, FILMSTRIP_FRAMES).then((result) => {
      if (!cancelled) setFrames(result)
    })
    return () => {
      cancelled = true
    }
  }, [file])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    const tick = () => {
      const video = videoRef.current
      if (video) {
        if (video.currentTime >= end || video.currentTime < start - 0.25) {
          video.currentTime = start
        }
        setPlayhead(video.currentTime)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, start, end])

  const panAxis: "x" | "y" | null = !dims
    ? null
    : dims.w > dims.h * 1.02
      ? "x"
      : dims.h > dims.w * 1.02
        ? "y"
        : null

  function seek(t: number) {
    const video = videoRef.current
    if (video) video.currentTime = t
    setPlayhead(t)
  }

  function pause() {
    videoRef.current?.pause()
    setPlaying(false)
  }

  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (playing) {
      pause()
      return
    }
    if (video.currentTime < start || video.currentTime >= end) {
      video.currentTime = start
    }
    void video
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false))
  }

  function toggleMute() {
    const video = videoRef.current
    const next = !muted
    if (video) video.muted = next
    setMuted(next)
  }

  // ─── Línea de tiempo ─────────────────────────────────

  function timeFromClientX(clientX: number): number {
    const rect = timelineRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return 0
    return clamp((clientX - rect.left) / rect.width, 0, 1) * duration
  }

  function handleTimelinePointerDown(
    mode: TimelineDragMode,
    e: ReactPointerEvent<HTMLElement>,
  ) {
    if (disabled) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    pause()
    timelineDragRef.current = {
      mode,
      originT: timeFromClientX(e.clientX),
      originStart: start,
      originEnd: end,
    }
  }

  function handleTimelinePointerMove(e: ReactPointerEvent<HTMLElement>) {
    const drag = timelineDragRef.current
    if (!drag) return
    const t = timeFromClientX(e.clientX)
    const max = PROMOTION_VIDEO_MAX_DURATION_SECONDS

    if (drag.mode === "start") {
      const nextStart = clamp(t, 0, drag.originEnd - MIN_CLIP_SECONDS)
      const nextEnd =
        drag.originEnd - nextStart > max ? nextStart + max : drag.originEnd
      setStart(nextStart)
      setEnd(nextEnd)
      seek(nextStart)
    } else if (drag.mode === "end") {
      const nextEnd = clamp(t, drag.originStart + MIN_CLIP_SECONDS, duration)
      const nextStart =
        nextEnd - drag.originStart > max ? nextEnd - max : drag.originStart
      setStart(nextStart)
      setEnd(nextEnd)
      seek(nextEnd)
    } else {
      const length = drag.originEnd - drag.originStart
      const nextStart = clamp(
        drag.originStart + (t - drag.originT),
        0,
        duration - length,
      )
      setStart(nextStart)
      setEnd(nextStart + length)
      seek(nextStart)
    }
  }

  function handleTimelinePointerUp() {
    timelineDragRef.current = null
  }

  // ─── Encuadre 1:1 ────────────────────────────────────

  function handlePreviewPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (disabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    panDragRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      origin: pan,
      moved: false,
    }
  }

  function handlePreviewPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = panDragRef.current
    if (!drag || !panAxis || !dims) return
    const dx = e.clientX - drag.clientX
    const dy = e.clientY - drag.clientY
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return
    drag.moved = true
    setPanning(true)

    const size = previewRef.current?.clientWidth ?? 0
    if (size <= 0) return
    if (panAxis === "x") {
      const overflow = size * (dims.w / dims.h) - size
      if (overflow > 0) {
        setPan({ x: clamp(drag.origin.x - dx / overflow, 0, 1), y: drag.origin.y })
      }
    } else {
      const overflow = size * (dims.h / dims.w) - size
      if (overflow > 0) {
        setPan({ x: drag.origin.x, y: clamp(drag.origin.y - dy / overflow, 0, 1) })
      }
    }
  }

  function handlePreviewPointerUp() {
    const drag = panDragRef.current
    panDragRef.current = null
    setPanning(false)
    if (drag && !drag.moved) togglePlay()
  }

  const selected = end - start
  const startPct = (start / duration) * 100
  const endPct = (end / duration) * 100
  const playheadPct = (clamp(playhead, 0, duration) / duration) * 100

  return (
    <div className="space-y-3">
      <div
        ref={previewRef}
        className={`relative mx-auto aspect-square w-full max-w-[280px] touch-none select-none overflow-hidden rounded-md bg-black ${
          panAxis ? (panning ? "cursor-grabbing" : "cursor-grab") : "cursor-pointer"
        }`}
        onPointerDown={handlePreviewPointerDown}
        onPointerMove={handlePreviewPointerMove}
        onPointerUp={handlePreviewPointerUp}
        onPointerCancel={handlePreviewPointerUp}
      >
        {previewUrl ? (
          <video
            ref={videoRef}
            src={previewUrl}
            className="pointer-events-none h-full w-full object-cover"
            style={{ objectPosition: `${pan.x * 100}% ${pan.y * 100}%` }}
            playsInline
            muted={muted}
            preload="auto"
            onLoadedMetadata={(e) => {
              const v = e.currentTarget
              if (v.videoWidth > 0 && v.videoHeight > 0) {
                setDims({ w: v.videoWidth, h: v.videoHeight })
              }
              v.currentTime = start
            }}
            onEnded={() => seek(start)}
            onError={() => onPreviewError?.()}
          />
        ) : null}

        {panAxis ? (
          <div
            className={`pointer-events-none absolute inset-0 transition-opacity ${
              panning ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="absolute inset-y-0 left-1/3 w-px bg-white/50" />
            <div className="absolute inset-y-0 left-2/3 w-px bg-white/50" />
            <div className="absolute inset-x-0 top-1/3 h-px bg-white/50" />
            <div className="absolute inset-x-0 top-2/3 h-px bg-white/50" />
          </div>
        ) : null}

        {!playing ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white">
              <Play className="ml-0.5 h-6 w-6" />
            </span>
          </div>
        ) : null}

        {panAxis && !panning ? (
          <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white">
            <Move className="h-3 w-3" />
            Arrastra para encuadrar
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={disabled}
            onClick={togglePlay}
            aria-label={playing ? "Pausar" : "Reproducir"}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={disabled}
            onClick={toggleMute}
            aria-label={muted ? "Activar sonido" : "Silenciar"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-[11px] tabular-nums text-muted-foreground">
          <span className="font-medium text-foreground">
            {formatVideoDuration(selected)}
          </span>{" "}
          · {formatPrecise(start)} – {formatPrecise(end)}
        </p>
      </div>

      <div
        ref={timelineRef}
        className="relative h-14 w-full touch-none select-none overflow-hidden rounded-md bg-muted"
      >
        <div className="absolute inset-0 flex">
          {frames.length > 0
            ? frames.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt=""
                  draggable={false}
                  className="h-full min-w-0 flex-1 object-cover"
                />
              ))
            : (
                <div className="h-full w-full bg-gradient-to-r from-muted via-muted-foreground/20 to-muted" />
              )}
        </div>

        <div
          className="pointer-events-none absolute inset-y-0 left-0 bg-black/55"
          style={{ width: `${startPct}%` }}
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 bg-black/55"
          style={{ width: `${100 - endPct}%` }}
        />

        <div
          className="absolute inset-y-0 cursor-grab border-y-2 border-violet-500 active:cursor-grabbing"
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
          onPointerDown={(e) => handleTimelinePointerDown("window", e)}
          onPointerMove={handleTimelinePointerMove}
          onPointerUp={handleTimelinePointerUp}
          onPointerCancel={handleTimelinePointerUp}
        >
          <div
            className="absolute inset-y-0 -left-1 flex w-4 cursor-ew-resize items-center justify-center rounded-l-md bg-violet-500"
            onPointerDown={(e) => handleTimelinePointerDown("start", e)}
            onPointerMove={handleTimelinePointerMove}
            onPointerUp={handleTimelinePointerUp}
            onPointerCancel={handleTimelinePointerUp}
            aria-label="Inicio del fragmento"
          >
            <span className="h-5 w-0.5 rounded-full bg-white/90" />
          </div>
          <div
            className="absolute inset-y-0 -right-1 flex w-4 cursor-ew-resize items-center justify-center rounded-r-md bg-violet-500"
            onPointerDown={(e) => handleTimelinePointerDown("end", e)}
            onPointerMove={handleTimelinePointerMove}
            onPointerUp={handleTimelinePointerUp}
            onPointerCancel={handleTimelinePointerUp}
            aria-label="Fin del fragmento"
          >
            <span className="h-5 w-0.5 rounded-full bg-white/90" />
          </div>
        </div>

        <div
          className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow"
          style={{ left: `${playheadPct}%` }}
        />
      </div>

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => {
            pause()
            onCancel()
          }}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          onClick={() => {
            pause()
            onConfirm({ start, end, pan })
          }}
        >
          <Scissors className="mr-2 h-4 w-4" />
          Usar este fragmento
        </Button>
      </div>
    </div>
  )
}
