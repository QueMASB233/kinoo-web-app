"use client"

import { useCallback, useEffect, useState } from "react"
import { adminApi } from "@/lib/admin-api"
import { AdminTeamTable } from "@/components/admin/admin-team-table"
import type { AdminTeamListItem, TeamRoleGroupFilter } from "@/types"

const PAGE_SIZE = 50

export default function AdminTeamPage() {
  const [members, setMembers] = useState<AdminTeamListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [roleGroup, setRoleGroup] = useState<TeamRoleGroupFilter>("all")
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
        role_group: roleGroup === "all" ? undefined : roleGroup,
      })
      setMembers(data.items)
      setTotal(data.total)
    } catch {
      setError("No se pudo cargar el equipo.")
    } finally {
      setIsLoading(false)
    }
  }, [page, searchQuery, roleGroup])

  useEffect(() => {
    void load()
  }, [load])

  function handleRoleGroupChange(next: TeamRoleGroupFilter) {
    setRoleGroup(next)
    setPage(1)
  }

  function handleSearch() {
    setSearchQuery(searchInput.trim())
    setPage(1)
  }

  function handleReset() {
    setSearchInput("")
    setSearchQuery("")
    setRoleGroup("all")
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Equipo</h1>
        <p className="mt-1 text-sm text-gray-500">
          Cuentas con acceso al panel:{" "}
          <span className="font-medium text-violet-700">Administradores</span>,{" "}
          <span className="font-medium text-amber-800">Operador IGS</span> y{" "}
          <span className="font-medium text-sky-700">Operador</span>. Desde aquí
          solo puedes dar de alta operadores; los admins se listan para consulta.
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

      <AdminTeamTable
        members={members}
        isLoading={isLoading}
        roleGroup={roleGroup}
        onRoleGroupChange={handleRoleGroupChange}
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        onSearch={handleSearch}
        onReset={handleReset}
        hasActiveFilters={Boolean(searchQuery) || roleGroup !== "all"}
        onReload={() => void load()}
        page={page}
        total={total}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  )
}
