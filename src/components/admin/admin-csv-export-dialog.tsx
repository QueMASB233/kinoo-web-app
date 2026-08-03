"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Download, Loader2 } from "lucide-react"
import { adminApi } from "@/lib/admin-api"
import type { AdminProviderOption } from "@/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ADMIN_FILTER_INPUT_CLASS,
  ADMIN_FILTER_LABEL_CLASS,
  ADMIN_FILTER_SELECT_CLASS,
} from "@/lib/constants"
import { cn } from "@/lib/utils"

export type CsvExportFilters = {
  providerId: string | null
  status: string
  dateFrom: string
  dateTo: string
}

type StatusOption = { value: string; label: string }

type AdminCsvExportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  statusOptions: StatusOption[]
  dateFromLabel?: string
  dateToLabel?: string
  downloadFilenamePrefix: string
  onDownload: (filters: CsvExportFilters) => Promise<Blob>
}

const ALL_PROVIDERS_LABEL = "Todos los proveedores"

function providerLabel(p: AdminProviderOption) {
  return `${p.full_name} (${p.email})`
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

function ProviderCombobox({
  providers,
  providerId,
  onSelect,
}: {
  providers: AdminProviderOption[]
  providerId: string
  onSelect: (id: string | null, display: string) => void
}) {
  const [inputValue, setInputValue] = useState("")
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

  useEffect(() => {
    if (!providerId) return
    const selected = providers.find((p) => p.id === providerId)
    if (selected) {
      setInputValue(providerLabel(selected))
    }
  }, [providerId, providers])

  const filtered = useMemo(() => {
    const q = inputValue.trim().toLowerCase()
    if (!q || inputValue === ALL_PROVIDERS_LABEL) {
      return providers
    }
    return providers.filter(
      (p) =>
        p.full_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q),
    )
  }, [providers, inputValue])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function pickAll() {
    onSelect(null, "")
    setInputValue("")
    setOpen(false)
  }

  function pickProvider(p: AdminProviderOption) {
    onSelect(p.id, providerLabel(p))
    setInputValue(providerLabel(p))
    setOpen(false)
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        placeholder={`${ALL_PROVIDERS_LABEL} — escribe para filtrar…`}
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value)
          onSelect(null, e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        className={ADMIN_FILTER_INPUT_CLASS}
      />
      {open && (
        <ul
          id={listboxId}
          className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg"
          role="listbox"
        >
          <li>
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-gray-600 hover:bg-gray-50"
              onMouseDown={(e) => e.preventDefault()}
              onClick={pickAll}
            >
              {ALL_PROVIDERS_LABEL}
            </button>
          </li>
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-gray-400">Sin coincidencias</li>
          ) : (
            filtered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={cn(
                    "w-full px-3 py-2 text-left hover:bg-gray-50",
                    providerId === p.id && "bg-emerald-50 text-emerald-900",
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickProvider(p)}
                >
                  {providerLabel(p)}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
      <p className="text-xs text-gray-400 mt-1">
        Opcional. Vacío o «{ALL_PROVIDERS_LABEL}» exporta todos.
      </p>
    </div>
  )
}

export function AdminCsvExportDialog({
  open,
  onOpenChange,
  title,
  description,
  statusOptions,
  dateFromLabel = "Fecha desde",
  dateToLabel = "Fecha hasta",
  downloadFilenamePrefix,
  onDownload,
}: AdminCsvExportDialogProps) {
  const [allProviders, setAllProviders] = useState<AdminProviderOption[]>([])
  const [providersReady, setProvidersReady] = useState(false)
  const [providersError, setProvidersError] = useState<string | null>(null)

  const [providerId, setProviderId] = useState("")
  const [status, setStatus] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setProvidersReady(false)
      return
    }

    let cancelled = false
    setProvidersReady(false)
    setProvidersError(null)
    setError(null)
    setProviderId("")
    setStatus("")
    setDateFrom("")
    setDateTo("")

    adminApi.providers
      .list({ page: 1, limit: 500 })
      .then((data) => {
        if (cancelled) return
        setAllProviders(data.items)
        setProvidersReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setProvidersError("No se pudieron cargar los proveedores")
        setAllProviders([])
        setProvidersReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [open])

  async function handleDownload() {
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setError("La fecha inicial no puede ser mayor que la fecha final.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const blob = await onDownload({
        providerId: providerId || null,
        status,
        dateFrom,
        dateTo,
      })
      const now = new Date()
      const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`
      triggerBlobDownload(blob, `${downloadFilenamePrefix}_${stamp}.csv`)
      onOpenChange(false)
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo exportar el archivo CSV",
      )
    } finally {
      setLoading(false)
    }
  }

  const formDisabled = !providersReady || !!providersError || loading

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {!providersReady ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-gray-500">
            <Loader2 className="h-7 w-7 animate-spin text-gray-400" />
            <span>Cargando proveedores…</span>
          </div>
        ) : providersError ? (
          <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-3">
            {providersError}
          </p>
        ) : (
          <div className="space-y-4 py-1">
            <div>
            <label className={`${ADMIN_FILTER_LABEL_CLASS} block mb-1`}>
              Proveedor
            </label>
              <ProviderCombobox
                providers={allProviders}
                providerId={providerId}
                onSelect={(id) => setProviderId(id ?? "")}
              />
            </div>

            <div>
              <label className={`${ADMIN_FILTER_LABEL_CLASS} block mb-1`}>
                Estado
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={`${ADMIN_FILTER_SELECT_CLASS} w-full min-w-0`}
              >
                {statusOptions.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`${ADMIN_FILTER_LABEL_CLASS} block mb-1`}>
                  {dateFromLabel}
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={ADMIN_FILTER_INPUT_CLASS}
                />
              </div>
              <div>
                <label className={`${ADMIN_FILTER_LABEL_CLASS} block mb-1`}>
                  {dateToLabel}
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={ADMIN_FILTER_INPUT_CLASS}
                />
              </div>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            disabled={formDisabled}
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={handleDownload}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Download className="h-4 w-4 mr-1" />
                Descargar CSV
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
