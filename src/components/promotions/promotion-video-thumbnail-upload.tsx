"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Loader2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { optimizePromotionImageFile } from "@/lib/optimize-promotion-image"

const MAX_FILE_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const

interface PromotionVideoThumbnailUploadProps {
  existingUrl?: string | null
  file: File | null
  onFileChange: (file: File | null) => void
  onClearExisting?: () => void
  error?: string | null
  disabled?: boolean
  /** Si true, el file viene de un fotograma del video (solo hint UI). */
  fromVideoFrame?: boolean
}

/**
 * Miniatura del video — independiente de image_url (portada de la publicación).
 */
export function PromotionVideoThumbnailUpload({
  existingUrl,
  file,
  onFileChange,
  onClearExisting,
  error,
  disabled = false,
  fromVideoFrame = false,
}: PromotionVideoThumbnailUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [clientError, setClientError] = useState<string | null>(null)
  const [optimizing, setOptimizing] = useState(false)

  useEffect(() => {
    if (!file) {
      setLocalPreview(null)
      return
    }
    const preview = URL.createObjectURL(file)
    setLocalPreview(preview)
    return () => URL.revokeObjectURL(preview)
  }, [file])

  async function handleFileChange(nextFile: File | null) {
    if (!nextFile) return

    if (!ACCEPTED_TYPES.includes(nextFile.type as (typeof ACCEPTED_TYPES)[number])) {
      setClientError("Usa una imagen JPG, PNG o WebP para la miniatura.")
      onFileChange(null)
      if (fileRef.current) fileRef.current.value = ""
      return
    }

    if (nextFile.size > MAX_FILE_BYTES) {
      setClientError("La miniatura no puede superar 5 MB.")
      onFileChange(null)
      if (fileRef.current) fileRef.current.value = ""
      return
    }

    setOptimizing(true)
    setClientError(null)
    try {
      const optimized = await optimizePromotionImageFile(nextFile)
      onFileChange(optimized)
    } catch (err) {
      setClientError(
        err instanceof Error
          ? err.message
          : "No se pudo optimizar la miniatura.",
      )
      onFileChange(null)
      if (fileRef.current) fileRef.current.value = ""
    } finally {
      setOptimizing(false)
    }
  }

  function handleRemove() {
    onFileChange(null)
    onClearExisting?.()
    setClientError(null)
    if (fileRef.current) fileRef.current.value = ""
  }

  const previewSrc = localPreview || existingUrl || null
  const displayError = error || clientError

  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
      <Label className="text-xs font-medium">Miniatura del video</Label>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        disabled={disabled || optimizing}
        onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
      />

      {previewSrc ? (
        <div className="space-y-2">
          <div className="relative aspect-square w-28 overflow-hidden rounded-md border border-border/60">
            <Image
              src={previewSrc}
              alt="Miniatura del video"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || optimizing}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Subir imagen
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || optimizing}
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
          size="sm"
          className="w-full justify-start"
          disabled={disabled || optimizing}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="mr-2 h-4 w-4" />
          {optimizing ? "Optimizando…" : "Subir imagen de miniatura"}
        </Button>
      )}

      {displayError ? (
        <p className="text-xs text-destructive">{displayError}</p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {optimizing ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Optimizando miniatura…
            </span>
          ) : fromVideoFrame ? (
            "Miniatura tomada de un fotograma del video. También puedes subir otra imagen."
          ) : (
            "Se usa como portada en listados y push. Si no eliges una, al subir el video se genera ~1 s automáticamente."
          )}
        </p>
      )}
    </div>
  )
}
