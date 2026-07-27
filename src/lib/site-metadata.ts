import type { Metadata } from "next"

export const SITE_NAME = "KYNOO"

export const rootMetadata: Metadata = {
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: "Plataforma web de KYNOO para proveedores y administración.",
  applicationName: SITE_NAME,
  appleWebApp: {
    title: SITE_NAME,
  },
}

export const providerPanelMetadata: Metadata = {
  title: "Panel Proveedor",
  description: "Gestiona tus promociones, reservas y créditos publicitarios en KYNOO.",
}

export const adminPanelMetadata: Metadata = {
  title: "Panel Admin",
  description: "Administración interna de KYNOO: revisión, auditoría y operaciones.",
}

export const loginMetadata: Metadata = {
  title: "Iniciar sesión",
  description: "Accede al panel web de KYNOO con tu correo y código de verificación.",
}
