"use client"

import { useCallback, useEffect, useState } from "react"
import { adminApi } from "@/lib/admin-api"
import { AdminTeamTable } from "@/components/admin/admin-team-table"
import type { AdminTeamListItem } from "@/types"

const PAGE_SIZE = 50

export default function AdminTeamPage() {
  const [members, setMembers] = useState<AdminTeamListItem[]>([])
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
      const data = await adminApi.team.list({
        page,
        limit: PAGE_SIZE,
        search: searchQuery || undefined,
      })
      setMembers(data.items)
      setTotal(data.total)
    } catch {
      setError("No se pudo cargar el equipo.")
    } finally {
      setIsLoading(false)
    }
  }, [page, searchQuery])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Equipo</h1>
        <p className="mt-1 text-sm text-gray-500">
          Operador IGS revisa suscripciones de Kynoo Pet Care, notas y créditos
          de emergencia. Operador consulta compras, órdenes, reservas, canjes y
          créditos de emergencia, sin editarlos.
          {total > 0 ? <span className="text-gray-400"> · {total} en total</span> : null}
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      <AdminTeamTable
        members={members}
        isLoading={isLoading}
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        onSearch={() => {
          setSearchQuery(searchInput.trim())
          setPage(1)
        }}
        onReset={() => {
          setSearchInput("")
          setSearchQuery("")
          setPage(1)
        }}
        hasActiveFilters={Boolean(searchQuery)}
        onReload={() => void load()}
        page={page}
        total={total}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  )
}
