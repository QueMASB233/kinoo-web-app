"use client"

/**
 * Galería de producto post-create (D23 / Fase 8).
 * Patrón ubicaciones: 1 foto por request, con «Subiendo…» y bloqueo.
 */
import { useRef, useState } from "react"
import { api, ApiError } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ImageIcon, Loader2, X } from "lucide-react"
import type { ProductMediaItem } from "@/types"

const PRODUCT_GALLERY_MAX_IMAGES = 5

interface ProductGalleryPickerProps {
  promotionId: string
  initialMedia?: ProductMediaItem[] | null
}

export function ProductGalleryPicker({
  promotionId,
  initialMedia,
}: ProductGalleryPickerProps) {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<ProductMediaItem[]>(() =>
    [...(initialMedia || [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    ),
  )
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const full = items.length >= PRODUCT_GALLERY_MAX_IMAGES
  const busy = uploading || deletingId != null

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    if (full) {
      toast({
        variant: "destructive",
        title: "Límite de galería",
        description: `Solo puedes subir hasta ${PRODUCT_GALLERY_MAX_IMAGES} fotos.`,
      })
      return
    }

    setUploading(true)
    try {
      const created = await api.productMedia.add(promotionId, file)
      setItems((prev) =>
        [...prev, created].sort(
          (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
        ),
      )
      toast({
        title: "Foto agregada",
        description: "La imagen ya está en la galería del producto.",
      })
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "No se pudo subir la imagen. Intenta de nuevo."
      toast({
        variant: "destructive",
        title: "Error al subir",
        description: message,
      })
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove(item: ProductMediaItem) {
    if (!item.id || busy) return
    setDeletingId(item.id)
    try {
      await api.productMedia.remove(promotionId, item.id)
      setItems((prev) => prev.filter((m) => m.id !== item.id))
      toast({
        title: "Foto eliminada",
        description: "Se quitó de la galería del producto.",
      })
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "No se pudo eliminar la imagen."
      toast({
        variant: "destructive",
        title: "Error al eliminar",
        description: message,
      })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium">Galería de fotos</Label>
        <span className="text-xs text-muted-foreground">
          {items.length} / {PRODUCT_GALLERY_MAX_IMAGES}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Hasta {PRODUCT_GALLERY_MAX_IMAGES} fotos. Se muestran en el detalle de la
        app junto a la portada.
      </p>

      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => {
            const isDeleting = deletingId === item.id
            return (
              <div
                key={item.id || item.url}
                className="relative h-24 w-24 overflow-hidden rounded-md border border-border bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url}
                  alt=""
                  className={`h-full w-full object-cover ${isDeleting ? "opacity-40" : ""}`}
                />
                {isDeleting ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-label="Eliminar imagen"
                    disabled={busy}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white shadow-sm transition hover:bg-black/90 disabled:opacity-50"
                    onClick={() => handleRemove(item)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
          <ImageIcon className="h-4 w-4 shrink-0" />
          Aún no hay fotos en la galería.
        </div>
      )}

      <div className="space-y-2">
        <Input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy || full}
          className="h-9 text-xs"
          onChange={handleFileChange}
        />
        {uploading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Subiendo…
          </p>
        ) : full ? (
          <p className="text-xs text-muted-foreground">
            Galería completa. Elimina una foto para agregar otra.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Elige una imagen (JPG, PNG o WebP, máx. 5 MB).
          </p>
        )}
      </div>
    </div>
  )
}
