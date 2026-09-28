"use client"

import { PromotionForm } from "@/components/promotions/promotion-form"

export default function AdminNewPublicationPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">
        Nueva publicación KYNOO
      </h1>
      <PromotionForm mode="create" context="admin" />
    </div>
  )
}
