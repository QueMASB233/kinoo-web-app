"use client"

import { useCallback, useEffect, useState } from "react"
import { adminApi } from "@/lib/admin-api"
import { AdminAppUsersTable } from "@/components/admin/admin-app-users-table"
import type { AdminAppUserListItem, AppUserRoleCode } from "@/types"

const PAGE_SIZE = 100

type RoleTab = "all" | AppUserRoleCode

export default function AdminAppUsersPage() {
  const [users, setUsers] = useState<AdminAppUserListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [roleTab, setRoleTab] = useState<RoleTab>("all")
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await adminApi.appUsers.list({
        page,
        limit: PAGE_SIZE,
        search: searchQuery || undefined,
        role: roleTab === "all" ? undefined : roleTab,
      })
      setUsers(data.items)
      setTotal(data.total)
    } catch {
      setError("No se pudieron cargar los usuarios de la app.")
    } finally {
      setIsLoading(false)
    }
  }, [page, searchQuery, roleTab])

  useEffect(() => {
    void load()
  }, [load])

  function handleRoleChange(next: RoleTab) {
    setRoleTab(next)
    setPage(1)
  }

  function handleSearch() {
    setSearchQuery(searchInput.trim())
    setPage(1)
  }

  function handleReset() {
    setSearchInput("")
    setSearchQuery("")
    setRoleTab("all")
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Usuarios</h1>
        <p className="text-sm text-gray-500 mt-1">
          Tutores de la app móvil con rol{" "}
          <span className="font-medium text-indigo-700">Owner</span> o{" "}
          <span className="font-medium text-rose-700">Member</span>.
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

      <AdminAppUsersTable
        users={users}
        onUsersChange={setUsers}
        isLoading={isLoading}
        roleTab={roleTab}
        onRoleTabChange={handleRoleChange}
        searchInput={searchInput}
        onSearchInputChange={setSearchInput}
        onSearch={handleSearch}
        onReset={handleReset}
        hasActiveFilters={Boolean(searchQuery) || roleTab !== "all"}
        page={page}
        total={total}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  )
}
