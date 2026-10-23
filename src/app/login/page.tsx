"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { api, ApiError } from "@/lib/api-client"
import { setTokens } from "@/lib/auth"
import { panelHomeForRole } from "@/lib/admin-access"
import { ROUTES, PANEL_WEB_ROLES } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { KynooLogo } from "@/components/brand/kynoo-logo"
import { PoweredByEleva } from "@/components/brand/powered-by-eleva"
import { ArrowLeft, Loader2 } from "lucide-react"

type Step = "email" | "otp"

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await api.auth.login(email)
      setStep("otp")
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.title
            ? `${err.title}. ${err.message}`
            : err.message
          : "Error al enviar el código. Intenta de nuevo.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const tokenData = await api.auth.verifyCode(email, code)
      setTokens(tokenData.access_token, tokenData.refresh_token)

      const userData = await api.users.me()
      if (
        userData.role_code &&
        PANEL_WEB_ROLES.includes(
          userData.role_code as (typeof PANEL_WEB_ROLES)[number],
        )
      ) {
        router.push(panelHomeForRole(userData.role_code) || ROUTES.LOGIN)
      } else {
        throw new ApiError(
          403,
          "No tienes permisos para acceder al panel. Contacta al administrador.",
        )
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.title
            ? `${err.title}. ${err.message}`
            : err.message
          : "Código inválido. Intenta de nuevo.",
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#f6f4f8]">
      {/* Atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(63,0,104,0.12), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(63,0,104,0.06), transparent 50%)",
        }}
      />

      {/* Top-left company logo */}
      <header className="relative z-10 flex items-center px-6 pt-6 sm:px-8 sm:pt-8">
        <KynooLogo height={32} priority className="drop-shadow-sm" />
      </header>

      {/* Auth form */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-[400px] rounded-2xl border border-border/60 bg-white/90 p-8 shadow-[0_12px_40px_-16px_rgba(63,0,104,0.18)] backdrop-blur-sm">
          <div className="mb-6 space-y-1.5 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {step === "email" ? "Inicia sesión" : "Verifica tu código"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {step === "email"
                ? "Ingresa tu email para recibir un código de acceso"
                : `Enviamos un código de 6 dígitos a ${email}`}
            </p>
          </div>

          {step === "email" ? (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  disabled={isLoading}
                  className="h-11"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                type="submit"
                className="h-11 w-full bg-[#3f0068] text-white hover:bg-[#3f0068]/90"
                disabled={isLoading || !email}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Continuar
              </Button>
            </form>
          ) : (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código de verificación</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={code}
                  onChange={(e) =>
                    setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  maxLength={6}
                  required
                  autoFocus
                  disabled={isLoading}
                  className="h-11 text-center font-mono text-lg tracking-[0.5em]"
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button
                type="submit"
                className="h-11 w-full bg-[#3f0068] text-white hover:bg-[#3f0068]/90"
                disabled={isLoading || code.length !== 6}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Verificar
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => {
                  setStep("email")
                  setCode("")
                  setError(null)
                }}
                disabled={isLoading}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Cambiar email
              </Button>
            </form>
          )}
        </div>
      </main>

      {/* Powered by Eleva */}
      <footer className="relative z-10 flex justify-center pb-8 pt-2">
        <PoweredByEleva />
      </footer>
    </div>
  )
}
