"use client"

import { useEffect, useRef, useState } from "react"
import { Film, ImageIcon, Play } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  formatFileSizeMb,
  formatVideoDuration,
} from "@/lib/promotion-video"
import { cn } from "@/lib/utils"

interface AdminPromotionMediaPanelProps {
  imageUrl?: string | null
  videoUrl?: string | null
  videoThumbnailUrl?: string | null
  videoDurationSeconds?: number | null
  videoBytes?: number | null
  /** image | video — si falta, se infiere con videoUrl. */
  mediaType?: "image" | "video" | null
  /** Thumbs más grandes (p. ej. dialog de publicaciones). */
  compactThumb?: boolean
  className?: string
}

/**
 * Media compacta para revisión admin.
 * Según media_type: solo imagen o solo video (XOR).
 */
export function AdminPromotionMediaPanel({
  imageUrl,
  videoUrl,
  videoThumbnailUrl,
  videoDurationSeconds,
  videoBytes,
  mediaType,
  compactThumb = true,
  className,
}: AdminPromotionMediaPanelProps) {
  const [videoOpen, setVideoOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  const isVideoMode =
    mediaType === "video" || (mediaType !== "image" && Boolean(videoUrl))
  const hasVideo = isVideoMode && Boolean(videoUrl)
  const videoPoster = videoThumbnailUrl || imageUrl || undefined
  const coverUrl = isVideoMode ? videoPoster : imageUrl
  const thumbSize = compactThumb ? "h-20 w-20" : "h-28 w-28"
  const durationLabel =
    videoDurationSeconds != null
      ? formatVideoDuration(videoDurationSeconds)
      : null
  const sizeLabel =
    videoBytes != null && videoBytes > 0
      ? formatFileSizeMb(videoBytes)
      : null

  useEffect(() => {
    if (videoOpen) return
    const el = videoRef.current
    if (!el) return
    el.pause()
    el.currentTime = 0
  }, [videoOpen])

  return (
    <>
      <div className={cn("flex items-start gap-3", className)}>
        <div className="flex shrink-0 gap-2.5">
          {hasVideo && videoUrl ? (
            <figure className="space-y-1">
              <button
                type="button"
                onClick={() => setVideoOpen(true)}
                className={cn(
                  "group relative block overflow-hidden rounded-lg border border-violet-200 bg-gray-50 transition-colors hover:border-violet-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2",
                  thumbSize,
                )}
                title="Ver video"
                aria-label="Abrir video para revisar"
              >
                {videoPoster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={videoPoster}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-violet-50">
                    <Film className="h-6 w-6 text-violet-300" />
                  </div>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/35 transition-colors group-hover:bg-black/45">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 shadow-sm">
                    <Play
                      className="ml-0.5 h-4 w-4 text-gray-900"
                      fill="currentColor"
                    />
                  </span>
                </span>
              </button>
              <figcaption className="text-center text-[10px] font-medium uppercase tracking-wide text-violet-500">
                Video
              </figcaption>
            </figure>
          ) : (
            <figure className="space-y-1">
              <div
                className={cn(
                  "overflow-hidden rounded-lg border border-gray-200 bg-gray-50",
                  thumbSize,
                )}
              >
                {coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageIcon className="h-6 w-6 text-gray-300" />
                  </div>
                )}
              </div>
              <figcaption className="text-center text-[10px] font-medium uppercase tracking-wide text-gray-400">
                Imagen
              </figcaption>
            </figure>
          )}
        </div>

        {hasVideo ? (
          <div className="min-w-0 space-y-1 pt-0.5">
            <div className="inline-flex items-center gap-1.5 rounded bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
              <Film className="h-3.5 w-3.5" />
              Modo video
            </div>
            <p className="text-xs leading-snug text-gray-500">
              Toca el video para revisarlo. Sin moderación automática.
            </p>
            {(durationLabel || sizeLabel) && (
              <p className="text-xs text-gray-400">
                {[durationLabel, sizeLabel].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
        ) : (
          <div className="min-w-0 space-y-1 pt-0.5">
            <div className="inline-flex items-center gap-1.5 rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              <ImageIcon className="h-3.5 w-3.5" />
              Modo imagen
            </div>
          </div>
        )}
      </div>

      {hasVideo && videoUrl ? (
        <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
          <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
            <DialogHeader className="space-y-1 px-4 pb-2 pt-4">
              <DialogTitle className="text-base">Revisar video</DialogTitle>
              <DialogDescription className="text-xs">
                {[durationLabel, sizeLabel].filter(Boolean).join(" · ") ||
                  "Reproduce el video completo antes de aprobar."}
              </DialogDescription>
            </DialogHeader>
            <div className="px-4 pb-4">
              <div className="aspect-square overflow-hidden rounded-lg border border-gray-200 bg-black">
                {videoOpen ? (
                  <video
                    ref={videoRef}
                    key={videoUrl}
                    src={videoUrl}
                    poster={videoPoster}
                    className="h-full w-full object-cover"
                    controls
                    playsInline
                    autoPlay
                    preload="metadata"
                  />
                ) : null}
              </div>
              <p className="mt-2 text-[11px] text-amber-800/90">
                El video no pasa por moderación automática. Revísalo completo
                antes de aprobar.
              </p>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}
