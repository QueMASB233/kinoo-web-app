"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Loader2, Upload, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { optimizePromotionImageFile } from "@/lib/optimize-promotion-image"

const MAX_FILE_BYTES = 5 * 1024 * 1024
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const

interface PromotionImageUploadProps {
  existingImageUrl?: string | null
  file: File | null
  onFileChange: (file: File | null) => void
  onClearExisting?: () => void
  error?: string | null
  disabled?: boolean
}

export function PromotionImageUpload({
  existingImageUrl,
  file,
  onFileChange,
  onClearExisting,
  error,
  disabled = false,
}: PromotionImageUploadProps) {
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
      setClientError("Usa una imagen JPG, PNG o WebP.")
      onFileChange(null)
      if (fileRef.current) fileRef.current.value = ""
      return
    }

    if (nextFile.size > MAX_FILE_BYTES) {
      setClientError("La imagen no puede superar 5 MB.")
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
          : "No se pudo optimizar la imagen. Intenta con otro archivo.",
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
    if (fileRef.current) fileRef.current.value = ""
  }

  const previewSrc = localPreview || existingImageUrl || null
  const displayError = error || clientError

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">Imagen de la publicación</Label>
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        disabled={disabled || optimizing}
        onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
      />

      {previewSrc ? (
        <div className="space-y-3">
          <div className="relative w-full max-w-sm aspect-[4/3] rounded-md overflow-hidden border border-border/60">
            <Image
              src={previewSrc}
              alt="Vista previa de la publicación"
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
              Cambiar imagen
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
          className="w-full justify-start gap-2 h-auto py-3"
          disabled={disabled || optimizing}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4 shrink-0" />
          <span className="text-sm">
            {optimizing
              ? "Optimizando imagen…"
              : "Seleccionar imagen (JPG, PNG, WebP, máx. 5 MB)"}
          </span>
        </Button>
      )}

      {displayError ? (
        <p className="text-xs text-destructive">{displayError}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {optimizing ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Convirtiendo a JPG y compactando para el aviso push (menos de 1
              MB)…
            </span>
          ) : (
            "Al elegirla se convierte a JPG y se optimiza para el push (menos de 1 MB). La validación de contenido se hace al guardar."
          )}
        </p>
      )}
    </div>
  )
}
