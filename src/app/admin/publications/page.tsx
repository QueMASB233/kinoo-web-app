"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Plus } from "lucide-react"
import { adminApi } from "@/lib/admin-api"
import { ROUTES } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { AdminPublicationsTable } from "@/components/admin/admin-publications-table"
import type { Promotion } from "@/types"

export default function AdminPublicationsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await adminApi.publications.list()
      setPromotions(data)
    } catch {
      setError("No se pudieron cargar las publicaciones.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function handlePromotionUpdated(updated: Promotion) {
    setPromotions((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p)),
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Publicaciones</h1>
          <p className="text-sm text-gray-500 mt-1">
            Promociones y servicios de los proveedores y de KYNOO. Puedes
            suspender una publicación para ocultarla en la app, o notificar a
            los usuarios de la zona (inventario que aún no recibió push).
          </p>
        </div>
        <Button
          asChild
          className="bg-[#4a6b1e] hover:bg-[#3d5a18] text-white"
        >
          <Link href={ROUTES.ADMIN_NEW_PUBLICATION}>
            <Plus className="mr-1 h-4 w-4" />
            Nueva publicación
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Cargando publicaciones...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : (
        <AdminPublicationsTable
          promotions={promotions}
          onPromotionUpdated={handlePromotionUpdated}
        />
      )}
    </div>
  )
}
