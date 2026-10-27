"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { useLookup } from "@/hooks/use-lookup"
import { api, ApiError } from "@/lib/api-client"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Loader2 } from "lucide-react"
import { KYNOO_POINTS_BRAND } from "@/lib/constants"
import { ProviderBillingCard } from "@/components/billing/provider-billing-card"

export default function ProfilePage() {
  const { user } = useAuth()
  const { toast } = useToast()
  const { countries, cities, loadCities } = useLookup()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [fullName, setFullName] = useState("")
  const [countryId, setCountryId] = useState<string>("")
  const [cityId, setCityId] = useState<string>("")

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "")
      setCountryId(user.country_id || "")
      setCityId(user.city_id || "")
      if (user.country_id) {
        loadCities(user.country_id)
      }
    }
  }, [user, loadCities])

  useEffect(() => {
    if (countryId) {
      loadCities(countryId)
    }
  }, [countryId, loadCities])

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      await api.users.updateProfile({
        full_name: fullName,
        country: countryId || null,
        city: cityId || null,
      })
      toast({
        title: "Perfil actualizado",
        description: "Los cambios se guardaron correctamente.",
      })
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          err instanceof ApiError
            ? err.message
            : "No se pudo actualizar el perfil.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!user) return null

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-lg font-semibold">Perfil</h2>

      {/* Avatar & info */}
      <Card className="border-border/60">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg bg-muted text-foreground font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-base font-semibold">{user.full_name}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Rol: {user.role_code || "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit form */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Editar información
          </CardTitle>
          <CardDescription className="text-xs">
            Actualiza tu nombre y ubicación
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-xs font-medium">
                Nombre completo
              </Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium">
                Email
              </Label>
              <Input
                id="email"
                value={user.email}
                disabled
                className="h-9 bg-muted/30"
              />
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">País</Label>
                <Select
                  value={countryId}
                  onValueChange={(v) => {
                    setCountryId(v)
                    setCityId("")
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Ciudad</Label>
                <Select
                  value={cityId}
                  onValueChange={setCityId}
                  disabled={!countryId || cities.length === 0}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Guardar cambios
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <ProviderBillingCard />

      {/* Stats */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Estadísticas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              {/* UI: Puntos KYNOO — saldo en BD como `referral_points` */}
              <p className="text-xs text-muted-foreground">{KYNOO_POINTS_BRAND}</p>
              <p className="text-lg font-semibold">{user.referral_points}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Referidos validados</p>
              <p className="text-lg font-semibold">
                {user.referral_validated_count}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
