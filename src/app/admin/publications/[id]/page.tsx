"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { api } from "@/lib/api-client"
import { ROUTES } from "@/lib/constants"
import { PromotionForm } from "@/components/promotions/promotion-form"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import type { Promotion } from "@/types"

export default function AdminEditPublicationPage() {
  const params = useParams()
  const router = useRouter()
  const [promotion, setPromotion] = useState<Promotion | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await api.promotions.get(params.id as string)
        if (data.publisher_type !== "kynoo") {
          setError(
            "Desde aquí solo se editan publicaciones KYNOO. Las de proveedores las edita su dueño.",
          )
          return
        }
        setPromotion(data)
      } catch {
        setError("Publicación no encontrada.")
      } finally {
        setIsLoading(false)
      }
    }
    if (params.id) void load()
  }, [params.id])

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl">
        <Skeleton className="h-8 w-[200px]" />
        <Skeleton className="h-[100px] rounded-lg" />
        <Skeleton className="h-[200px] rounded-lg" />
        <Skeleton className="h-[200px] rounded-lg" />
      </div>
    )
  }

  if (error || !promotion) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-gray-500 mb-4">
          {error || "Publicación no encontrada."}
        </p>
        <Button
          variant="outline"
          onClick={() => router.push(ROUTES.ADMIN_PUBLICATIONS)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a publicaciones
        </Button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">
        Editar publicación KYNOO
      </h1>
      <PromotionForm initialData={promotion} mode="edit" context="admin" />
    </div>
  )
}
