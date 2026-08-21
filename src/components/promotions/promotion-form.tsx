"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { api, ApiError } from "@/lib/api-client"
import {
  BENEFIT_TYPE_LABELS,
  BENEFIT_TYPES_BY_PUBLICATION_TYPE,
  isBenefitAllowedForPublication,
  KYNOO_POINTS_BRAND,
  ROUTES,
} from "@/lib/constants"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { DatePicker } from "@/components/shared/date-picker"
import {
  PetTargetingSection,
  sanitizePetFilters,
} from "./pet-targeting-section"
import {
  UserTargetingSection,
  sanitizeUserFilters,
} from "./user-targeting-section"
import { LocationPicker } from "./location-picker"
import { PromotionImageUpload } from "./promotion-image-upload"
import { Loader2, ArrowLeft, Info, MapPin } from "lucide-react"
import type {
  Promotion,
  PromotionType,
  BenefitType,
  CreatePromotionRequest,
  UpdatePromotionRequest,
  PetFilters,
  UserFilters,
} from "@/types"

// ─── Schema ──────────────────────────────────────────────

const formSchema = z
  .object({
    type: z.enum(["promotion", "service"]),
    title: z.string().min(3, "Mínimo 3 caracteres").max(255),
    description: z.string().optional(),
    benefit_type: z.enum(["discount", "free_product", "service", "points_only"]),
  link: z
    .string()
    .refine((val) => val === "" || val.startsWith("https://"), {
      message: "La URL debe comenzar con https://",
    })
    .optional(),
  coupon_code: z.string().optional(),
  redeem_message: z.string().optional(),
  is_referral_only: z.boolean(),
  min_referral_points_required: z.coerce.number().min(0),
  points_cost: z.coerce.number().min(0),
  is_single_use_per_user: z.boolean(),
  has_limited_stock: z.boolean(),
  stock_total: z.coerce.number().min(0).optional(),
  start_date: z.date(),
  end_date: z.date(),
  is_active: z.boolean(),
  is_featured_eligible: z.boolean(),
  // Service fields
  business_name: z.string().optional(),
  business_address: z.string().optional(),
  business_phone: z.string().optional(),
  business_email: z.string().optional(),
  business_whatsapp: z.string().optional(),
  service_price: z.coerce.number().min(0).optional(),
  is_presential: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (!isBenefitAllowedForPublication(data.type, data.benefit_type)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["benefit_type"],
        message:
          data.type === "promotion"
            ? 'Las promociones no pueden tener "Servicio" como tipo de beneficio'
            : 'Los servicios deben tener "Servicio" como tipo de beneficio',
      })
    }
  })

type FormValues = z.infer<typeof formSchema>

const IMAGE_UPLOAD_ERROR_TITLES = new Set([
  "Imagen no permitida",
  "No se pudo validar la imagen",
  "Formato no válido",
  "Archivo demasiado grande",
  "Archivo inválido",
  "Error al subir",
])

function isPromotionImageError(err: unknown, sentPhoto: boolean): boolean {
  if (!sentPhoto || !(err instanceof ApiError)) return false
  return IMAGE_UPLOAD_ERROR_TITLES.has(err.title || "")
}

// ─── Component ───────────────────────────────────────────

interface PromotionFormProps {
  initialData?: Promotion
  mode: "create" | "edit"
}

export function PromotionForm({ initialData, mode }: PromotionFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null)
  const [imageRemoved, setImageRemoved] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [petFilters, setPetFilters] = useState<PetFilters>(
    () =>
      (initialData?.targeting?.pet_filters as PetFilters | undefined) || {},
  )
  const [userFilters, setUserFilters] = useState<UserFilters>(
    () =>
      (initialData?.targeting?.user_filters as UserFilters | undefined) || {},
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData
      ? {
          type: initialData.type,
          title: initialData.title,
          description: initialData.description || "",
          benefit_type: initialData.benefit_type,
          link: initialData.link || "",
          coupon_code: initialData.coupon_code || "",
          redeem_message: initialData.redeem_message || "",
          is_referral_only: initialData.is_referral_only,
          min_referral_points_required:
            initialData.is_referral_only
              ? initialData.min_referral_points_required
              : 0,
          points_cost: initialData.points_cost ?? 0,
          is_single_use_per_user: initialData.is_single_use_per_user,
          has_limited_stock: initialData.stock_total != null,
          stock_total: initialData.stock_total ?? undefined,
          start_date: new Date(initialData.start_date),
          end_date: new Date(initialData.end_date),
          is_active: initialData.is_active,
          is_featured_eligible: initialData.is_featured_eligible,
          business_name: initialData.business_name || "",
          business_address: initialData.business_address || "",
          business_phone: initialData.business_phone || "",
          business_email: initialData.business_email || "",
          business_whatsapp: initialData.business_whatsapp || "",
          service_price: initialData.service_price ?? undefined,
          is_presential: initialData.is_presential,
        }
      : {
          type: "promotion" as PromotionType,
          title: "",
          description: "",
          benefit_type: "discount" as BenefitType,
          link: "",
          coupon_code: "",
          redeem_message: "",
          is_referral_only: false,
          min_referral_points_required: 0,
          points_cost: 0,
          is_single_use_per_user: true,
          has_limited_stock: false,
          stock_total: undefined,
          start_date: new Date(),
          end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          is_active: true,
          is_featured_eligible: false,
          business_name: "",
          business_address: "",
          business_phone: "",
          business_email: "",
          business_whatsapp: "",
          service_price: undefined,
          is_presential: true,
        },
  })

  const watchType = form.watch("type")
  const watchBenefitType = form.watch("benefit_type")
  const watchHasLimitedStock = form.watch("has_limited_stock")
  const watchIsReferralOnly = form.watch("is_referral_only")
  const watchMinReferralPoints = form.watch("min_referral_points_required")
  const watchPointsCost = form.watch("points_cost")

  const allowedBenefitTypes = BENEFIT_TYPES_BY_PUBLICATION_TYPE[watchType]

  useEffect(() => {
    if (!isBenefitAllowedForPublication(watchType, watchBenefitType)) {
      form.setValue(
        "benefit_type",
        watchType === "service" ? "service" : "discount",
      )
    }
  }, [watchType, watchBenefitType, allowedBenefitTypes, form])

  async function onSubmit(values: FormValues) {
    if (values.end_date <= values.start_date) {
      form.setError("end_date", {
        message: "La fecha de fin debe ser posterior a la de inicio",
      })
      return
    }

    setIsSubmitting(true)
    setImageError(null)

    const targeting: Record<string, unknown> = {}
    // Sanitize: drop empty arrays and any value outside the API allow-list
    // so the backend doesn't 422 on stale or unknown values.
    const cleanedPetFilters = sanitizePetFilters(petFilters)
    if (Object.keys(cleanedPetFilters).length > 0) {
      targeting.pet_filters = cleanedPetFilters
    }
    const cleanedUserFilters = sanitizeUserFilters(userFilters)
    if (Object.keys(cleanedUserFilters).length > 0) {
      targeting.user_filters = cleanedUserFilters
    }

    let imageUrl: string | null = null
    if (mode === "edit" && initialData) {
      if (imageRemoved) {
        imageUrl = null
      } else if (!selectedImageFile) {
        imageUrl = initialData.image_url || null
      }
    }

    const publicationType =
      mode === "edit" && initialData ? initialData.type : values.type
    const isService = publicationType === "service"
    const pointsCost = isService
      ? 0
      : Math.max(0, Math.floor(Number(values.points_cost) || 0))
    const minReferralPoints =
      isService || !values.is_referral_only
        ? 0
        : Math.max(0, Math.floor(Number(values.min_referral_points_required) || 0))

    const payload = {
      type: publicationType,
      title: values.title,
      description: values.description || null,
      benefit_type: values.benefit_type,
      image_url: imageUrl,
      link: values.link || null,
      coupon_code: values.coupon_code || null,
      redeem_message: values.redeem_message || null,
      points_required: 0,
      points_cost: pointsCost,
      is_referral_only: Boolean(values.is_referral_only),
      min_referral_points_required: minReferralPoints,
      is_single_use_per_user: values.is_single_use_per_user,
      stock_total: values.has_limited_stock ? (values.stock_total ?? null) : null,
      start_date: values.start_date.toISOString(),
      end_date: values.end_date.toISOString(),
      is_active: values.is_active,
      is_featured_eligible: values.is_featured_eligible,
      country_id: null,
      city_id: null,
      targeting,
      business_name: values.business_name || null,
      business_address: values.business_address || null,
      business_phone: values.business_phone || null,
      business_email: values.business_email || null,
      business_whatsapp: values.business_whatsapp || null,
      service_price: values.service_price ?? null,
      is_presential: values.is_presential,
    }

    const photoToSend = selectedImageFile

    try {
      if (mode === "create") {
        const created = await api.promotions.create(
          payload as CreatePromotionRequest,
          photoToSend,
        )
        toast({
          title: "Publicación creada",
          description:
            "Ahora agrega las ubicaciones. Cuando el admin apruebe, se avisará a los usuarios de esa zona. Ten todos los puntos listos.",
        })
        router.push(ROUTES.EDIT_PROMOTION(created.id))
        return
      } else if (initialData) {
        await api.promotions.update(
          initialData.id,
          payload as UpdatePromotionRequest,
          photoToSend,
        )
        toast({
          title: "Publicación actualizada",
          description: "Los cambios se guardaron correctamente.",
        })
      }
      router.push(ROUTES.PROMOTIONS)
    } catch (err) {
      const isImageError = isPromotionImageError(err, photoToSend != null)

      if (isImageError) {
        setImageError(
          err instanceof ApiError
            ? err.message
            : "La imagen no cumple las políticas de contenido.",
        )
      }

      toast({
        variant: "destructive",
        title:
          err instanceof ApiError
            ? isImageError
              ? err.title || "Imagen no permitida"
              : err.title || "Error"
            : "Error",
        description:
          err instanceof ApiError
            ? err.message
            : "No se pudo guardar la publicación.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-3xl">
      {/* Back button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => router.push(ROUTES.PROMOTIONS)}
        className="text-muted-foreground -ml-2"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Volver
      </Button>

      {/* Type selection */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Tipo de publicación</CardTitle>
          <CardDescription className="text-xs">
            Elige si quieres publicar una promoción o un servicio
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            {(["promotion", "service"] as const).map((t) => {
              const isSelected = watchType === t
              const isLocked = mode === "edit"
              return (
                <button
                  key={t}
                  type="button"
                  disabled={isLocked}
                  onClick={() => {
                    form.setValue("type", t)
                    if (t === "service") {
                      form.setValue("benefit_type", "service")
                      form.setValue("min_referral_points_required", 0)
                      form.setValue("points_cost", 0)
                      form.setValue("is_referral_only", false)
                    } else if (form.getValues("benefit_type") === "service") {
                      form.setValue("benefit_type", "discount")
                    }
                  }}
                  className={`flex-1 rounded-lg border-2 p-4 text-center transition-colors ${
                    isSelected
                      ? "border-foreground bg-muted/50"
                      : isLocked
                        ? "border-border opacity-50 cursor-not-allowed"
                        : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <p className="text-sm font-medium">
                    {t === "promotion" ? "Promoción" : "Servicio"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t === "promotion"
                      ? "Descuentos, productos gratis, cupones"
                      : "Servicios presenciales o virtuales"}
                  </p>
                </button>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Una vez creada la publicación no se permite cambiar de tipo.
          </p>
        </CardContent>
      </Card>

      {/* Basic Info */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Información básica</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-xs font-medium">
              Título *
            </Label>
            <Input
              id="title"
              {...form.register("title")}
              placeholder="Nombre de tu publicación"
              className="h-9"
            />
            {form.formState.errors.title && (
              <p className="text-xs text-destructive">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-xs font-medium">
              Descripción
            </Label>
            <Textarea
              id="description"
              {...form.register("description")}
              placeholder="Describe tu publicación..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium">Tipo de beneficio *</Label>
            <Select
              value={form.watch("benefit_type")}
              disabled={watchType === "service"}
              onValueChange={(v) =>
                form.setValue("benefit_type", v as BenefitType)
              }
            >
              <SelectTrigger
                className={`h-9 ${watchType === "service" ? "opacity-70 cursor-not-allowed" : ""}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedBenefitTypes.map((benefitType) => (
                  <SelectItem key={benefitType} value={benefitType}>
                    {BENEFIT_TYPE_LABELS[benefitType]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {watchType === "promotion" ? (
              <p className="text-xs text-muted-foreground">
                Las promociones admiten descuentos, productos gratis o canje por
                puntos. Para ofrecer un servicio, elige &quot;Servicio&quot; como
                tipo de publicación.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Los servicios siempre tienen beneficio &quot;Servicio&quot;. Este
                campo queda fijo automáticamente.
              </p>
            )}
            {form.formState.errors.benefit_type && (
              <p className="text-xs text-destructive">
                {form.formState.errors.benefit_type.message}
              </p>
            )}
          </div>

          <PromotionImageUpload
            existingImageUrl={
              imageRemoved ? null : initialData?.image_url || null
            }
            file={selectedImageFile}
            onFileChange={(file) => {
              setSelectedImageFile(file)
              setImageRemoved(false)
              setImageError(null)
            }}
            onClearExisting={() => {
              setImageRemoved(true)
              setImageError(null)
            }}
            error={imageError}
            disabled={isSubmitting}
          />
        </CardContent>
      </Card>

      {/* Redemption / Coupon */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Canje y cupones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="coupon_code" className="text-xs font-medium">
                Código de cupón
              </Label>
              <Input
                id="coupon_code"
                {...form.register("coupon_code")}
                placeholder="DESCUENTO20"
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link" className="text-xs font-medium">
                URL externa
              </Label>
              <Input
                id="link"
                {...form.register("link")}
                placeholder="https://..."
                className="h-9"
              />
              {form.formState.errors.link && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.link.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="redeem_message" className="text-xs font-medium">
              Mensaje de canje
            </Label>
            <Textarea
              id="redeem_message"
              {...form.register("redeem_message")}
              placeholder="Muestra esta pantalla en el checkout..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Puntos y acceso */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Puntos y acceso</CardTitle>
          <CardDescription className="text-xs">
            Define si cuesta puntos y si es solo para personas con referidos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {watchType === "promotion" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Label htmlFor="points_cost" className="text-xs font-medium">
                  Costo en {KYNOO_POINTS_BRAND}
                </Label>
                {Number(watchPointsCost) > 0 ? (
                  <Badge
                    variant="outline"
                    className="text-xs font-normal tabular-nums bg-violet-50 text-violet-700 border-violet-200"
                  >
                    {watchPointsCost} pts
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-xs font-normal bg-emerald-50 text-emerald-700 border-emerald-200"
                  >
                    Gratis
                  </Badge>
                )}
              </div>
              <Input
                id="points_cost"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                {...form.register("points_cost")}
                className="h-9 w-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                {Number(watchPointsCost) > 0
                  ? `Se descontarán ${watchPointsCost} puntos al canjear.`
                  : "0 = gratis. No se descuentan puntos."}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Label className="text-xs font-medium">Solo por referidos</Label>
              <p className="text-xs text-muted-foreground">
                Quienes invitaron a alguien o llegaron con una invitación.
              </p>
            </div>
            <Switch
              checked={watchIsReferralOnly}
              onCheckedChange={(v) => {
                form.setValue("is_referral_only", v, { shouldDirty: true })
                if (!v) {
                  form.setValue("min_referral_points_required", 0, {
                    shouldDirty: true,
                  })
                }
              }}
            />
          </div>

          {watchType === "promotion" && watchIsReferralOnly && (
            <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Label
                  htmlFor="min_referral_points_required"
                  className="text-xs font-medium"
                >
                  Puntos mínimos
                </Label>
                {Number(watchMinReferralPoints) > 0 ? (
                  <Badge
                    variant="outline"
                    className="text-xs font-normal tabular-nums bg-orange-50 text-orange-700 border-orange-200"
                  >
                    {watchMinReferralPoints} pts mín.
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-xs font-normal bg-slate-50 text-slate-600 border-slate-200"
                  >
                    Sin mínimo extra
                  </Badge>
                )}
              </div>
              <Input
                id="min_referral_points_required"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                {...form.register("min_referral_points_required")}
                className="h-9 w-[200px]"
              />
              <p className="text-xs text-muted-foreground">
                {Number(watchMinReferralPoints) > 0
                  ? `Debe tener al menos ${watchMinReferralPoints} puntos (no se descuentan).`
                  : "Opcional. 0 = solo aplica la regla de referidos."}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <Label className="text-xs font-medium">Uso único por usuario</Label>
              <p className="text-xs text-muted-foreground">
                {watchType === "service"
                  ? "Cada usuario solo puede comprar una vez"
                  : "Cada usuario solo puede canjear una vez"}
              </p>
            </div>
            <Switch
              checked={form.watch("is_single_use_per_user")}
              onCheckedChange={(v) =>
                form.setValue("is_single_use_per_user", v, { shouldDirty: true })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Stock */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Stock y disponibilidad</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs font-medium">Stock limitado</Label>
              <p className="text-xs text-muted-foreground">
                Limitar la cantidad de canjes disponibles
              </p>
            </div>
            <Switch
              checked={watchHasLimitedStock}
              onCheckedChange={(v) => form.setValue("has_limited_stock", v)}
            />
          </div>

          {watchHasLimitedStock && (
            <div className="space-y-2">
              <Label htmlFor="stock_total" className="text-xs font-medium">
                Stock total
              </Label>
              <Input
                id="stock_total"
                type="number"
                min={0}
                {...form.register("stock_total")}
                className="h-9 w-[200px]"
              />
            </div>
          )}

          <Separator />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Fecha de inicio *</Label>
              <DatePicker
                value={form.watch("start_date")}
                onChange={(d) => d && form.setValue("start_date", d)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Fecha de fin *</Label>
              <DatePicker
                value={form.watch("end_date")}
                onChange={(d) => d && form.setValue("end_date", d)}
              />
              {form.formState.errors.end_date && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.end_date.message}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Location — Geo-targeting via map */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Ubicación</CardTitle>
          <CardDescription className="text-xs">
            Configura la ubicación para geo-targeting
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === "edit" && initialData ? (
            <LocationPicker
              promotionId={initialData.id}
              promotionType={initialData.type}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
              <div className="rounded-full bg-muted p-3">
                <MapPin className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  Guarda la publicación primero
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Después de crear la publicación podrás agregar ubicaciones en el mapa.
                  Ten todos los puntos listos: al aprobar, se avisará a los usuarios de esa zona.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Targeting — user + pet filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <h3 className="text-sm font-semibold">Segmentación de la audiencia</h3>
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Cómo funcionan los filtros"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Mostraremos la promoción a usuarios que coincidan en TODOS los
                filtros activos. Dentro de cada filtro basta con que cumplan
                UNO de los valores seleccionados.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <UserTargetingSection value={userFilters} onChange={setUserFilters} />
        <PetTargetingSection value={petFilters} onChange={setPetFilters} />
      </div>

      {/* Service-specific fields */}
      {watchType === "service" && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">
              Datos del negocio
            </CardTitle>
            <CardDescription className="text-xs">
              Información visible para los usuarios del servicio
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="business_name" className="text-xs font-medium">
                Nombre del negocio
              </Label>
              <Input
                id="business_name"
                {...form.register("business_name")}
                placeholder="Mi Negocio"
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="business_address" className="text-xs font-medium">
                Dirección
              </Label>
              <Input
                id="business_address"
                {...form.register("business_address")}
                placeholder="Calle 123, Ciudad"
                className="h-9"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="business_phone" className="text-xs font-medium">
                  Teléfono
                </Label>
                <Input
                  id="business_phone"
                  {...form.register("business_phone")}
                  placeholder="+1234567890"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="business_whatsapp"
                  className="text-xs font-medium"
                >
                  WhatsApp
                </Label>
                <Input
                  id="business_whatsapp"
                  {...form.register("business_whatsapp")}
                  placeholder="+1234567890"
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="business_email" className="text-xs font-medium">
                Email de contacto
              </Label>
              <Input
                id="business_email"
                type="email"
                {...form.register("business_email")}
                placeholder="contacto@minegocio.com"
                className="h-9"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="service_price" className="text-xs font-medium">
                  Precio del servicio
                </Label>
                <Input
                  id="service_price"
                  type="number"
                  step="0.01"
                  min={0}
                  {...form.register("service_price")}
                  placeholder="0.00"
                  className="h-9"
                />
              </div>
              <div className="flex items-center justify-between pt-6">
                <Label className="text-xs font-medium">Servicio presencial</Label>
                <Switch
                  checked={form.watch("is_presential")}
                  onCheckedChange={(v) => form.setValue("is_presential", v)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settings */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Configuración</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs font-medium">Publicación activa</Label>
              <p className="text-xs text-muted-foreground">
                Si está activa, será visible para los usuarios
              </p>
            </div>
            <Switch
              checked={form.watch("is_active")}
              onCheckedChange={(v) => form.setValue("is_active", v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-xs font-medium">Elegible para destacada</Label>
              <p className="text-xs text-muted-foreground">
                Permite que esta publicación sea destacada
              </p>
            </div>
            <Switch
              checked={form.watch("is_featured_eligible")}
              onCheckedChange={(v) => form.setValue("is_featured_eligible", v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting} className="min-w-[140px] bg-[#4a6b1e] hover:bg-[#3d5a18] text-white">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {mode === "create" ? "Crear publicación" : "Guardar cambios"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(ROUTES.PROMOTIONS)}
        >
          Cancelar
        </Button>
      </div>
    </form>
  )
}
