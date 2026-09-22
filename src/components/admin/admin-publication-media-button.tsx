"use client"

import { useState } from "react"
import { Film } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AdminPromotionMediaPanel } from "./admin-promotion-media-panel"
import type { Promotion } from "@/types"

interface AdminPublicationMediaButtonProps {
  promotion: Promotion
}

/** Abre preview de imagen/video desde el listado de publicaciones admin. */
export function AdminPublicationMediaButton({
  promotion,
}: AdminPublicationMediaButtonProps) {
  const [open, setOpen] = useState(false)
  const hasVideo =
    (promotion.media_type === "video" ||
      (promotion.media_type !== "image" && Boolean(promotion.video_url))) &&
    Boolean(promotion.video_url)
  const hasImage = Boolean(promotion.image_url)

  if (!hasVideo && !hasImage) {
    return <span className="text-xs text-gray-400">—</span>
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
        title={hasVideo ? "Ver video" : "Ver imagen"}
      >
        {hasVideo ? (
          <>
            <Film className="h-3 w-3 text-violet-600" />
            Video
          </>
        ) : (
          "Imagen"
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="pr-6 text-base">{promotion.title}</DialogTitle>
            <DialogDescription>
              {hasVideo
                ? "Modo video. Toca para reproducirlo."
                : "Vista previa de la imagen."}
            </DialogDescription>
          </DialogHeader>
          <AdminPromotionMediaPanel
            imageUrl={promotion.image_url}
            videoUrl={promotion.video_url}
            videoThumbnailUrl={promotion.video_thumbnail_url}
            videoDurationSeconds={promotion.video_duration_seconds}
            videoBytes={promotion.video_bytes}
            mediaType={promotion.media_type}
            compactThumb={false}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
