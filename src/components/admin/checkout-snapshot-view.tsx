"use client"

import type { CheckoutSnapshot, ShippingSnapshot } from "@/types"

type Props = {
  snapshot?: CheckoutSnapshot | null
  className?: string
  compact?: boolean
}

function modeLabel(mode?: string | null): string {
  if (mode === "with_data") return "Con datos"
  if (mode === "final_consumer") return "Consumidor final"
  return mode || "—"
}

function shippingLines(shipping?: ShippingSnapshot | null) {
  if (!shipping) return []
  const address = [shipping.address_line, shipping.city, shipping.province, shipping.country_code]
    .filter(Boolean)
    .join(", ")
  return [
    { label: "Recibe", value: shipping.recipient_name || "—" },
    { label: "Tel. envío", value: shipping.recipient_phone_e164 || "—" },
    { label: "Dirección", value: address || "—" },
    ...(shipping.reference
      ? [{ label: "Referencia", value: shipping.reference }]
      : []),
  ]
}

export function CheckoutSnapshotView({
  snapshot,
  className,
  compact = false,
}: Props) {
  if (!snapshot) {
    return (
      <p className={`text-xs text-muted-foreground ${className || ""}`}>
        Sin snapshot de facturación
      </p>
    )
  }

  const billing = snapshot.billing
  const shipping = snapshot.shipping
  const lines: Array<{ label: string; value: string }> = [
    { label: "Teléfono", value: snapshot.phone_e164 || "—" },
    { label: "Modo", value: modeLabel(billing?.mode) },
  ]

  if (billing?.mode === "with_data") {
    lines.push(
      {
        label: "ID",
        value: [billing.id_type, billing.id_number].filter(Boolean).join(" ") || "—",
      },
      { label: "Nombre", value: billing.legal_name || "—" },
      { label: "Email fiscal", value: billing.billing_email || "—" },
      { label: "Dirección fiscal", value: billing.billing_address_line || "—" },
    )
  }

  const shipLines = shippingLines(shipping)

  if (compact) {
    const shipHint = shipping?.city
      ? ` · Envío: ${shipping.city}`
      : shipping?.recipient_name
        ? ` · Envío: ${shipping.recipient_name}`
        : ""
    return (
      <p className={`text-xs text-muted-foreground ${className || ""}`}>
        {snapshot.phone_e164 || "—"} · {modeLabel(billing?.mode)}
        {billing?.mode === "with_data" && billing.legal_name
          ? ` · ${billing.legal_name}`
          : ""}
        {shipHint}
      </p>
    )
  }

  return (
    <div className={`space-y-3 ${className || ""}`}>
      <div className="space-y-1 rounded-md border border-border/60 bg-muted/20 p-3">
        <p className="text-xs font-medium text-foreground">Facturación (snapshot)</p>
        {lines.map((row) => (
          <div key={row.label} className="flex gap-2 text-xs">
            <span className="w-28 shrink-0 text-muted-foreground">{row.label}</span>
            <span className="text-foreground break-all">{row.value}</span>
          </div>
        ))}
      </div>
      {shipLines.length > 0 ? (
        <div className="space-y-1 rounded-md border border-border/60 bg-muted/20 p-3">
          <p className="text-xs font-medium text-foreground">Envío (snapshot)</p>
          {shipLines.map((row) => (
            <div key={row.label} className="flex gap-2 text-xs">
              <span className="w-28 shrink-0 text-muted-foreground">{row.label}</span>
              <span className="text-foreground break-all">{row.value}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
