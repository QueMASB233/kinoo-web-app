"use client"

import { useCallback, useEffect, useState } from "react"
import { adminApi } from "@/lib/admin-api"
import { AdminProvidersTable } from "@/components/admin/admin-providers-table"
import type { AdminProviderListItem } from "@/types"

const PAGE_SIZE = 50

export default function AdminProvidersPage() {
  const [providers, setProviders] = useState<AdminProviderListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await adminApi.providers.list({
        page,
        limit: PAGE_SIZE,
        search: searchQuery || undefined,
      })
      setProviders(data.items)
      setTotal(data.total)
    } catch {
      setError("No se pudieron cargar los proveedores.")
    } finally {
      setIsLoading(false)
    }
  }, [page, searchQuery])

  useEffect(() => {
    void load()
  }, [load])

  function handleSearch() {
    setSearchQuery(searchInput.trim())
    setPage(1)
  }

  function handleReset() {
    setSearchInput("")
    setSearchQuery("")
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Proveedores</h1>
        <p className="text-sm text-gray-500 mt-1">
          Crea cuentas de proveedor para el panel web. El primer acceso es con
          OTP al correo registrado; tras verificar, la cuenta queda activada.
          {total > 0 ? (
            <span className="text-gray-400"> · {total} en total</span>
          ) : null}
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <AdminProvidersTable
        providers={providers}
        onProvidersChange={setProviders}
        onReload={() => void load()}
        isLoading={isLoading}
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        onSearch={handleSearch}
        onReset={handleReset}
        hasActiveFilters={Boolean(searchQuery)}
        page={page}
        total={total}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  )
}
