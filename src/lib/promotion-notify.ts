import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { Promotion } from "@/types"

export const PROVIDER_ZONE_NOTIFY_COPY =
  "Cuando el admin apruebe, se avisará a los usuarios de la zona de los puntos que tengas en ese momento. Asegúrate de tener todas las ubicaciones listas. Si agregas puntos después, esos usuarios nuevos no recibirán notificación (sí verán la publicación en el feed si están cerca)."

export const ADMIN_RESEND_NOTIFY_WARNING =
  "Esta publicación ya se notificó. Volver a enviar puede repetir el push a las mismas personas. Úsalo solo si hace falta."

export function formatUsersNotifiedAt(iso: string): string {
  return format(new Date(iso), "dd MMM yyyy", { locale: es })
}

export function isActiveForZoneNotify(promo: Promotion): boolean {
  return (
    !promo.admin_suspended &&
    promo.is_active &&
    promo.status === "active"
  )
}
