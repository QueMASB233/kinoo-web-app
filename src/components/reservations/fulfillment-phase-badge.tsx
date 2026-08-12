import { Badge } from "@/components/ui/badge"
import { FULFILLMENT_PHASE_LABELS } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { PromotionOrderFulfillmentPhase } from "@/types"

const phaseStyles: Record<string, string> = {
  pending_contact: "bg-amber-50 text-amber-800 border-amber-200",
  scheduled: "bg-sky-50 text-sky-800 border-sky-200",
  submitted: "bg-violet-50 text-violet-800 border-violet-200",
  verified: "bg-emerald-50 text-emerald-800 border-emerald-200",
  rejected: "bg-red-50 text-red-800 border-red-200",
  refunded: "bg-purple-50 text-purple-800 border-purple-200",
  not_applicable: "bg-zinc-50 text-zinc-500 border-zinc-200",
}

interface FulfillmentPhaseBadgeProps {
  phase: PromotionOrderFulfillmentPhase | string | null | undefined
}

export function FulfillmentPhaseBadge({ phase }: FulfillmentPhaseBadgeProps) {
  const key = phase || "not_applicable"
  const label = FULFILLMENT_PHASE_LABELS[key] || key
  const style = phaseStyles[key] || phaseStyles.not_applicable

  return (
    <Badge variant="outline" className={cn("text-xs font-normal", style)}>
      {label}
    </Badge>
  )
}
