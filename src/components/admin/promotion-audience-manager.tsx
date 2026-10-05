"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  AlertTriangle,
  Download,
  FileUp,
  History,
  Loader2,
  Trash2,
  Users,
} from "lucide-react"
import { adminApi } from "@/lib/admin-api"
import { ApiError } from "@/lib/api-client"
import { PROMOTION_AUDIENCE_MODE_LABELS } from "@/lib/constants"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AdminNotifyZoneButton } from "@/components/admin/admin-notify-zone-button"
import type {
  AudienceImportHistoryItem,
  AudienceImportMode,
  AudienceImportReport,
  AudienceList,
  Promotion,
  PromotionAudienceMode,
} from "@/types"

const PAGE_SIZE = 20

const IMPORT_REASON_LABELS: Record<string, string> = {
  vacio: "Vacío",
  uuid_invalido: "UUID inválido",
  no_encontrado: "No existe",
  usuario_eliminado: "Usuario eliminado",
  rol_no_permitido: "No es usuario de la app",
}

const IMPORT_MODE_LABELS: Record<AudienceImportMode, string> = {
  replace: "Reemplazar la lista",
  append: "Agregar a la lista",
}

const IMPORT_MODE_HINTS: Record<AudienceImportMode, string> = {
  replace: "La lista quedará exactamente igual a los usuarios válidos del CSV.",
  append: "Se suman los usuarios nuevos; los que ya estaban se mantienen.",
}

type PendingConfirm = "to_all" | "to_list_empty" | "clear" | null

function formatDateTime(iso: string) {
  return format(new Date(iso), "dd MMM yyyy HH:mm", { locale: es })
}

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`
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

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError || err instanceof Error ? err.message : fallback
}

interface PromotionAudienceManagerProps {
  promotion: Promotion
  onAudienceChange?: (mode: PromotionAudienceMode, count: number) => void
}

export function PromotionAudienceManager({
  promotion: initialPromotion,
  onAudienceChange,
}: PromotionAudienceManagerProps) {
  const { toast } = useToast()
  const [promotion, setPromotion] = useState(initialPromotion)
  const [audience, setAudience] = useState<AudienceList | null>(null)
  const [page, setPage] = useState(1)
  const [loadingAudience, setLoadingAudience] = useState(true)
  const [history, setHistory] = useState<AudienceImportHistoryItem[] | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [importMode, setImportMode] = useState<AudienceImportMode>("replace")
  const [report, setReport] = useState<AudienceImportReport | null>(null)
  const [validating, setValidating] = useState(false)
  const [applying, setApplying] = useState(false)
  const [changingMode, setChangingMode] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const promotionId = promotion.id
  const mode: PromotionAudienceMode = promotion.audience_mode ?? "all"
  const total = audience?.total ?? promotion.audience_count ?? 0
  const busy = validating || applying || changingMode || clearing

  const loadAudience = useCallback(
    async (targetPage: number): Promise<AudienceList | null> => {
      setLoadingAudience(true)
      try {
        const data = await adminApi.audience.list(promotionId, {
          page: targetPage,
          limit: PAGE_SIZE,
        })
        setAudience(data)
        return data
      } catch (err) {
        toast({
          variant: "destructive",
          title: "Error",
          description: errorMessage(err, "No se pudo cargar la audiencia."),
        })
        return null
      } finally {
        setLoadingAudience(false)
      }
    },
    [promotionId, toast],
  )

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      setHistory(await adminApi.audience.imports(promotionId))
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage(err, "No se pudo cargar el historial."),
      })
    } finally {
      setLoadingHistory(false)
    }
  }, [promotionId, toast])

  useEffect(() => {
    void loadAudience(page)
  }, [loadAudience, page])

  useEffect(() => {
    if (showHistory && history == null) void loadHistory()
  }, [showHistory, history, loadHistory])

  function syncAudience(nextMode: PromotionAudienceMode, count: number) {
    setPromotion((prev) => ({
      ...prev,
      audience_mode: nextMode,
      audience_count: count,
    }))
    onAudienceChange?.(nextMode, count)
  }

  async function refreshAfterWrite() {
    setPage(1)
    setHistory(null)
    const fresh = await loadAudience(1)
    if (fresh) syncAudience(fresh.audience_mode, fresh.total)
  }

  // ─── Importación CSV ─────────────────────────────────

  async function validate(target: File, targetMode: AudienceImportMode) {
    setValidating(true)
    setReport(null)
    try {
      setReport(
        await adminApi.audience.importCsv(promotionId, target, {
          mode: targetMode,
          dryRun: true,
        }),
      )
    } catch (err) {
      setFile(null)
      toast({
        variant: "destructive",
        title: err instanceof ApiError ? err.title || "CSV no válido" : "CSV no válido",
        description: errorMessage(err, "No se pudo validar el archivo."),
      })
    } finally {
      setValidating(false)
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null
    event.target.value = ""
    if (!selected) return
    setFile(selected)
    void validate(selected, importMode)
  }

  function handleImportModeChange(next: AudienceImportMode) {
    if (next === importMode) return
    setImportMode(next)
    if (file) void validate(file, next)
  }

  function discardImport() {
    setFile(null)
    setReport(null)
  }

  async function applyImport() {
    if (!file || !report) return
    setApplying(true)
    try {
      const result = await adminApi.audience.importCsv(promotionId, file, {
        mode: importMode,
        dryRun: false,
      })
      toast({
        title: "Audiencia actualizada",
        description: `${plural(result.audience_total, "usuario")} en la lista (+${result.inserted_count} / −${result.removed_count}).`,
      })
      discardImport()
      await refreshAfterWrite()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "No se aplicó el CSV",
        description: errorMessage(err, "No se pudo aplicar el archivo."),
      })
    } finally {
      setApplying(false)
    }
  }

  // ─── Modo, exportar y vaciar ─────────────────────────

  function requestModeChange(next: PromotionAudienceMode) {
    if (next === mode) return
    if (next === "all") setPendingConfirm("to_all")
    else if (total === 0) setPendingConfirm("to_list_empty")
    else void applyModeChange(next)
  }

  async function applyModeChange(next: PromotionAudienceMode) {
    setChangingMode(true)
    try {
      const res = await adminApi.audience.setMode(promotionId, next)
      syncAudience(res.audience_mode, res.audience_count)
      toast({
        title: "Audiencia actualizada",
        description:
          res.audience_mode === "list"
            ? "Ahora solo la ven los usuarios de la lista."
            : "Ahora la ven los usuarios de la zona, según sus ubicaciones.",
      })
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage(err, "No se pudo cambiar la audiencia."),
      })
    } finally {
      setChangingMode(false)
    }
  }

  async function clearAudience() {
    setClearing(true)
    try {
      const res = await adminApi.audience.clear(promotionId)
      toast({
        title: "Audiencia vaciada",
        description: `Se quitaron ${plural(res.removed_count, "usuario")}.`,
      })
      await refreshAfterWrite()
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage(err, "No se pudo vaciar la audiencia."),
      })
    } finally {
      setClearing(false)
    }
  }

  async function exportAudience() {
    setExporting(true)
    try {
      const blob = await adminApi.audience.exportCsv(promotionId)
      triggerBlobDownload(blob, `audiencia_${promotionId}.csv`)
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage(err, "No se pudo descargar la audiencia."),
      })
    } finally {
      setExporting(false)
    }
  }

  function confirmPending() {
    const action = pendingConfirm
    setPendingConfirm(null)
    if (action === "to_all") void applyModeChange("all")
    else if (action === "to_list_empty") void applyModeChange("list")
    else if (action === "clear") void clearAudience()
  }

  const confirmCopy: Record<
    Exclude<PendingConfirm, null>,
    { title: string; description: string; action: string }
  > = {
    to_all: {
      title: "¿Mostrar a todos los usuarios?",
      description:
        "La publicación será visible para todos los usuarios de la zona (según sus ubicaciones y la segmentación). La lista se conserva por si vuelves al modo lista.",
      action: "Mostrar a todos",
    },
    to_list_empty: {
      title: "¿Pasar a modo lista?",
      description:
        "La lista está vacía: nadie verá esta publicación hasta que subas un CSV.",
      action: "Pasar a modo lista",
    },
    clear: {
      title: "¿Vaciar la audiencia?",
      description:
        mode === "list"
          ? "Se quitarán todos los usuarios de la lista. Nadie verá la publicación hasta que subas otro CSV."
          : "Se quitarán todos los usuarios de la lista.",
      action: "Vaciar audiencia",
    },
  }

  const totalPages = audience ? Math.max(1, Math.ceil(audience.total / PAGE_SIZE)) : 1

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Audiencia</CardTitle>
        <CardDescription className="text-xs">
          Los cambios de esta sección se guardan al instante, sin pulsar
          &quot;Guardar cambios&quot;.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Modo */}
        <div className="flex flex-col gap-2 sm:flex-row">
          {(["all", "list"] as const).map((option) => (
            <button
              key={option}
              type="button"
              disabled={busy}
              onClick={() => requestModeChange(option)}
              className={`flex-1 rounded-lg border-2 p-3 text-left transition-colors disabled:opacity-60 ${
                mode === option
                  ? "border-foreground bg-muted/50"
                  : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <p className="text-sm font-medium">
                {PROMOTION_AUDIENCE_MODE_LABELS[option]}
                {changingMode && mode !== option && (
                  <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />
                )}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {option === "all"
                  ? "La ven los usuarios cerca de sus ubicaciones, con la segmentación elegida."
                  : "Solo la ven, canjean o pagan los usuarios del CSV, estén donde estén."}
              </p>
            </button>
          ))}
        </div>

        {mode === "list" && total === 0 && !loadingAudience && (
          <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Nadie verá esta publicación hasta que subas un CSV.
          </p>
        )}
        {mode === "all" && total > 0 && (
          <p className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Hay {plural(total, "usuario")} en la lista, pero no se aplica mientras
            el modo sea &quot;Todos los usuarios&quot;.
          </p>
        )}

        {/* Resumen */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4 text-muted-foreground" />
            {loadingAudience && !audience ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            ) : (
              <>
                <strong className="tabular-nums">{total}</strong>
                {total === 1 ? " usuario" : " usuarios"} en la audiencia
                {audience && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {audience.with_push_count} con notificaciones activas
                  </span>
                )}
              </>
            )}
          </span>
        </div>

        {/* Subir CSV */}
        <div className="space-y-3 rounded-lg border border-border/60 p-3">
          <div>
            <Label className="text-xs font-medium">Subir CSV</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Columna obligatoria <code>user_id</code> con el ID de la tabla{" "}
              <code>users</code> (no el de Supabase Auth). Máximo 20 000 filas y 2
              MB. Primero se valida; nada se guarda hasta que confirmes.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {(["replace", "append"] as const).map((option) => (
              <button
                key={option}
                type="button"
                disabled={busy}
                onClick={() => handleImportModeChange(option)}
                className={`flex-1 rounded-md border px-3 py-2 text-left transition-colors disabled:opacity-60 ${
                  importMode === option
                    ? "border-foreground bg-muted/50"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <p className="text-xs font-medium">{IMPORT_MODE_LABELS[option]}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {IMPORT_MODE_HINTS[option]}
                </p>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="mr-1.5 h-4 w-4" />
              {file ? "Elegir otro archivo" : "Elegir archivo CSV"}
            </Button>
            {file && (
              <span className="text-xs text-muted-foreground truncate max-w-[260px]">
                {file.name}
              </span>
            )}
            {validating && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Validando…
              </span>
            )}
          </div>

          {report && (
            <ImportReportView
              report={report}
              applying={applying}
              disabled={busy}
              onApply={() => void applyImport()}
              onDiscard={discardImport}
            />
          )}
        </div>

        {/* Miembros */}
        {audience && audience.items.length > 0 && (
          <div className="space-y-2">
            <div className="overflow-x-auto rounded-md border border-border/60">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 text-left text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Usuario</th>
                    <th className="px-3 py-2 font-medium">Origen</th>
                    <th className="px-3 py-2 font-medium">Agregado</th>
                  </tr>
                </thead>
                <tbody>
                  {audience.items.map((member) => (
                    <tr key={member.user_id} className="border-t border-border/40">
                      <td className="px-3 py-2">
                        <p className="font-medium">
                          {member.full_name || member.email || "Sin nombre"}
                        </p>
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {member.user_id}
                        </p>
                      </td>
                      <td className="px-3 py-2 uppercase text-muted-foreground">
                        {member.source}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {formatDateTime(member.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                <span>
                  Página {page} de {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loadingAudience}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loadingAudience}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Acciones */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={total === 0 || exporting}
            onClick={() => void exportAudience()}
          >
            {exporting ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-1.5 h-4 w-4" />
            )}
            Descargar CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={total === 0 || busy}
            onClick={() => setPendingConfirm("clear")}
            className="text-destructive hover:text-destructive"
          >
            {clearing ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-1.5 h-4 w-4" />
            )}
            Vaciar audiencia
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory((v) => !v)}
          >
            <History className="mr-1.5 h-4 w-4" />
            {showHistory ? "Ocultar historial" : "Historial de cargas"}
          </Button>
        </div>

        {showHistory && (
          <ImportHistoryView history={history} loading={loadingHistory} />
        )}

        {mode === "list" && (
          <div className="border-t border-border/60 pt-4">
            <AdminNotifyZoneButton
              promotion={promotion}
              onUpdated={setPromotion}
              variant="button"
            />
          </div>
        )}
      </CardContent>

      <Dialog
        open={pendingConfirm != null}
        onOpenChange={(open) => {
          if (!open) setPendingConfirm(null)
        }}
      >
        {pendingConfirm && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{confirmCopy[pendingConfirm].title}</DialogTitle>
              <DialogDescription>
                {confirmCopy[pendingConfirm].description}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPendingConfirm(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant={pendingConfirm === "clear" ? "destructive" : "default"}
                onClick={confirmPending}
              >
                {confirmCopy[pendingConfirm].action}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </Card>
  )
}

// ─── Reporte de validación ──────────────────────────────

function ImportReportView({
  report,
  applying,
  disabled,
  onApply,
  onDiscard,
}: {
  report: AudienceImportReport
  applying: boolean
  disabled: boolean
  onApply: () => void
  onDiscard: () => void
}) {
  const stats: { label: string; value: number; tone?: string }[] = [
    { label: "Filas", value: report.total_rows },
    { label: "Válidos", value: report.valid_count, tone: "text-emerald-700" },
    { label: "Vacíos o UUID inválido", value: report.invalid_count },
    { label: "No existen", value: report.not_found_count },
    { label: "No elegibles", value: report.ineligible_count },
    { label: "Duplicados", value: report.duplicate_count },
  ]
  const hasValid = report.valid_count > 0

  return (
    <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-md bg-background px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            <p className={`text-base font-semibold tabular-nums ${stat.tone ?? ""}`}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <p className="text-xs">
        Al aplicar: <strong>+{report.inserted_count}</strong> nuevos
        {report.mode === "replace" && (
          <>
            , <strong>−{report.removed_count}</strong> que ya no están en el CSV
          </>
        )}
        . La audiencia quedará en <strong>{plural(report.audience_total, "usuario")}</strong>
        , {report.with_push_count} con notificaciones activas.
      </p>

      {report.not_found_count > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Si muchos &quot;no existen&quot;, revisa que la columna tenga el{" "}
          <code>users.id</code> y no el <code>supabase_user_id</code>.
        </p>
      )}

      {report.errors_sample.length > 0 && (
        <div className="max-h-48 overflow-y-auto rounded-md border border-border/60 bg-background">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-muted/60 text-left text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 font-medium">Fila</th>
                <th className="px-2 py-1.5 font-medium">Valor</th>
                <th className="px-2 py-1.5 font-medium">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {report.errors_sample.map((item) => (
                <tr key={`${item.row}-${item.value}`} className="border-t border-border/40">
                  <td className="px-2 py-1 tabular-nums">{item.row}</td>
                  <td className="px-2 py-1 font-mono break-all">{item.value || "—"}</td>
                  <td className="px-2 py-1">
                    {IMPORT_REASON_LABELS[item.reason] || item.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!hasValid && (
        <p className="text-xs text-red-600">
          El CSV no tiene usuarios válidos; no se puede aplicar.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!hasValid || disabled}
          onClick={onApply}
          className="bg-[#4a6b1e] hover:bg-[#3d5a18] text-white"
        >
          {applying && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Aplicar: {IMPORT_MODE_LABELS[report.mode].toLowerCase()}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={applying}
          onClick={onDiscard}
        >
          Descartar
        </Button>
      </div>
    </div>
  )
}

// ─── Historial ──────────────────────────────────────────

function ImportHistoryView({
  history,
  loading,
}: {
  history: AudienceImportHistoryItem[] | null
  loading: boolean
}) {
  if (loading || history == null) {
    return (
      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Cargando historial…
      </p>
    )
  }
  if (history.length === 0) {
    return <p className="text-xs text-muted-foreground">Aún no hay cargas.</p>
  }
  return (
    <ul className="space-y-2">
      {history.map((item) => {
        const discarded =
          item.invalid_count +
          item.not_found_count +
          item.ineligible_count +
          item.duplicate_count
        return (
          <li
            key={item.id}
            className="rounded-md border border-border/60 px-3 py-2 text-xs"
          >
            <p className="font-medium">
              {formatDateTime(item.created_at)} · {IMPORT_MODE_LABELS[item.mode]}
            </p>
            <p className="text-muted-foreground">
              {item.uploaded_by_name || "Admin"}
              {item.file_name ? ` · ${item.file_name}` : ""}
            </p>
            <p className="text-muted-foreground">
              {item.total_rows} filas · {item.valid_count} válidos · +
              {item.inserted_count} / −{item.removed_count}
              {discarded > 0 ? ` · ${discarded} descartados` : ""}
            </p>
          </li>
        )
      })}
    </ul>
  )
}
