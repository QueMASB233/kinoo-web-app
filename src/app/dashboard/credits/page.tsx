"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { api, ApiError } from "@/lib/api-client"
import { useProviderCredits } from "@/hooks/use-provider-credits"
import { useToast } from "@/hooks/use-toast"
import {
  PENDING_CREDIT_CHECKOUT_URL_KEY,
  PENDING_CREDIT_ORDER_KEY,
} from "@/lib/constants"
import { CreditBalanceCard } from "@/components/credits/credit-balance-card"
import { CreditsNonRefundableNotice } from "@/components/credits/credits-non-refundable-notice"
import { CreditPacksGrid } from "@/components/credits/credit-packs-grid"
import { CustomCreditPurchaseModal } from "@/components/credits/custom-credit-purchase"
import { CreditTransactionsTable } from "@/components/credits/credit-transactions-table"
import { NuveiCheckoutModal } from "@/components/credits/nuvei-checkout-modal"
import { PendingPaymentBanner } from "@/components/credits/pending-payment-banner"
import { CheckoutIdentityDialog } from "@/components/billing/checkout-identity-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import type {
  CheckoutIdentityPayload,
  CreditPack,
  CustomPurchaseSettings,
  ProviderCreditOrder,
  ProviderCreditLedgerEntry,
} from "@/types"

const POLL_INTERVAL_MS = 4000
const MAX_POLL_ATTEMPTS = 45

function isPendingStatus(status: string) {
  return status === "pending" || status === "processing"
}

function resolveCheckoutUrl(
  order: ProviderCreditOrder | null,
  storedUrl: string | null,
): string | null {
  if (storedUrl) return storedUrl
  if (order?.checkout_url) return order.checkout_url
  return null
}

function shouldPollOrder(order: ProviderCreditOrder, checkoutUrl: string | null) {
  if (!isPendingStatus(order.status)) return false
  return Boolean(checkoutUrl) || order.status === "processing"
}

export default function CreditsPage() {
  const { toast } = useToast()
  const { balance, refreshBalance } = useProviderCredits()
  const [packs, setPacks] = useState<CreditPack[]>([])
  const [customPurchase, setCustomPurchase] =
    useState<CustomPurchaseSettings | null>(null)
  const [transactions, setTransactions] = useState<ProviderCreditLedgerEntry[]>(
    [],
  )
  const [pendingOrder, setPendingOrder] = useState<ProviderCreditOrder | null>(
    null,
  )
  const [pendingCheckoutUrl, setPendingCheckoutUrl] = useState<string | null>(
    null,
  )
  const [isLoading, setIsLoading] = useState(true)
  const [purchasingPackId, setPurchasingPackId] = useState<string | null>(null)
  const [isPurchasingCustom, setIsPurchasingCustom] = useState(false)
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false)
  const [identityOpen, setIdentityOpen] = useState(false)
  const [pendingPurchase, setPendingPurchase] = useState<
    { pack_id: string } | { credits: number } | null
  >(null)
  const pollAttempts = useRef(0)

  const refreshData = useCallback(async () => {
    const [, txRes] = await Promise.all([
      refreshBalance(),
      api.credits.transactions(30, 0),
    ])
    setTransactions(txRes.items)
  }, [refreshBalance])

  const loadInitial = useCallback(async () => {
    setIsLoading(true)
    try {
      const [packsRes, txRes] = await Promise.all([
        api.credits.packs(),
        api.credits.transactions(30, 0),
      ])
      setPacks(packsRes.packs)
      setCustomPurchase(packsRes.custom_purchase ?? null)
      setTransactions(txRes.items)

      const storedOrderId =
        typeof window !== "undefined"
          ? sessionStorage.getItem(PENDING_CREDIT_ORDER_KEY)
          : null
      const storedCheckoutUrl =
        typeof window !== "undefined"
          ? sessionStorage.getItem(PENDING_CREDIT_CHECKOUT_URL_KEY)
          : null
      if (storedCheckoutUrl) {
        setPendingCheckoutUrl(storedCheckoutUrl)
      }

      if (storedOrderId) {
        try {
          const order = await api.credits.getOrder(storedOrderId)
          setPendingOrder(order)
          const url = resolveCheckoutUrl(order, storedCheckoutUrl)
          if (url) {
            setPendingCheckoutUrl(url)
            sessionStorage.setItem(PENDING_CREDIT_CHECKOUT_URL_KEY, url)
          }
        } catch {
          sessionStorage.removeItem(PENDING_CREDIT_ORDER_KEY)
          sessionStorage.removeItem(PENDING_CREDIT_CHECKOUT_URL_KEY)
        }
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo cargar la información de créditos.",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadInitial()
  }, [loadInitial])

  const clearPendingOrder = useCallback(() => {
    sessionStorage.removeItem(PENDING_CREDIT_ORDER_KEY)
    sessionStorage.removeItem(PENDING_CREDIT_CHECKOUT_URL_KEY)
    setPendingOrder(null)
    setPendingCheckoutUrl(null)
    pollAttempts.current = 0
    setIsPolling(false)
  }, [])

  const handleOpenCheckout = useCallback(() => {
    if (!pendingCheckoutUrl) return
    setIsCheckoutOpen(true)
  }, [pendingCheckoutUrl])

  useEffect(() => {
    if (!pendingOrder || !shouldPollOrder(pendingOrder, pendingCheckoutUrl)) {
      setIsPolling(false)
      return
    }

    setIsPolling(true)
    pollAttempts.current = 0

    const orderId = pendingOrder.id

    const syncOrderStatus = async () => {
      pollAttempts.current += 1
      try {
        const order = await api.credits.getOrder(orderId)
        setPendingOrder(order)
        const url = resolveCheckoutUrl(order, pendingCheckoutUrl)
        if (url && url !== pendingCheckoutUrl) {
          setPendingCheckoutUrl(url)
          sessionStorage.setItem(PENDING_CREDIT_CHECKOUT_URL_KEY, url)
        }

        if (order.status === "paid") {
          setIsCheckoutOpen(false)
          await refreshData()
          toast({
            title: "Créditos acreditados",
            description: "Tu pago fue confirmado correctamente.",
          })
          clearPendingOrder()
        } else if (
          order.status === "failed" ||
          order.status === "expired" ||
          order.status === "refunded"
        ) {
          clearPendingOrder()
        } else if (pollAttempts.current >= MAX_POLL_ATTEMPTS) {
          setIsPolling(false)
          toast({
            variant: "destructive",
            title: "Pago pendiente",
            description:
              "Aún no recibimos confirmación. Si pagaste, espera unos minutos o contacta soporte.",
          })
        }
      } catch {
        /* ignorar errores transitorios de red */
      }
    }

    const onReturnToTab = () => {
      void syncOrderStatus()
    }

    window.addEventListener("focus", onReturnToTab)
    document.addEventListener("visibilitychange", onReturnToTab)

    const interval = setInterval(() => {
      void syncOrderStatus()
    }, POLL_INTERVAL_MS)

    return () => {
      clearInterval(interval)
      window.removeEventListener("focus", onReturnToTab)
      document.removeEventListener("visibilitychange", onReturnToTab)
    }
  }, [pendingOrder, pendingCheckoutUrl, refreshData, toast, clearPendingOrder])

  async function startCheckout(
    payload:
      | ({ pack_id: string } & CheckoutIdentityPayload)
      | ({ credits: number } & CheckoutIdentityPayload),
    loadingKey: string,
  ) {
    const isCustom = "credits" in payload
    if (isCustom) {
      setIsPurchasingCustom(true)
    } else {
      setPurchasingPackId(loadingKey)
    }
    try {
      const idempotencyKey =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${loadingKey}`

      const res = await api.credits.createOrder(payload, idempotencyKey)
      const checkoutUrl = res.checkout_url ?? null

      setPendingOrder(res.order)
      sessionStorage.setItem(PENDING_CREDIT_ORDER_KEY, res.order.id)

      if (checkoutUrl) {
        setPendingCheckoutUrl(checkoutUrl)
        sessionStorage.setItem(PENDING_CREDIT_CHECKOUT_URL_KEY, checkoutUrl)
        if (isCustom) {
          setIsCustomModalOpen(false)
        }
        setIsCheckoutOpen(true)
      } else {
        setPendingCheckoutUrl(null)
        sessionStorage.removeItem(PENDING_CREDIT_CHECKOUT_URL_KEY)
        toast({
          title: "Orden creada",
          description: res.message,
          variant: "destructive",
        })
      }
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "No se pudo crear la orden."
      toast({
        variant: "destructive",
        title: "Error",
        description: message,
      })
    } finally {
      setPurchasingPackId(null)
      setIsPurchasingCustom(false)
      setPendingPurchase(null)
    }
  }

  function handlePurchase(packId: string) {
    setPendingPurchase({ pack_id: packId })
    setIdentityOpen(true)
  }

  function handleCustomPurchase(credits: number) {
    setPendingPurchase({ credits })
    setIdentityOpen(true)
  }

  async function handleIdentityConfirm(identity: CheckoutIdentityPayload) {
    if (!pendingPurchase) return
    setIdentityOpen(false)
    const loadingKey =
      "pack_id" in pendingPurchase ? pendingPurchase.pack_id : "custom"
    await startCheckout({ ...pendingPurchase, ...identity }, loadingKey)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[100px] rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[180px] rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-[240px] rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <CheckoutIdentityDialog
        open={identityOpen}
        onOpenChange={(open) => {
          setIdentityOpen(open)
          if (!open) setPendingPurchase(null)
        }}
        onConfirm={(payload) => void handleIdentityConfirm(payload)}
      />

      <NuveiCheckoutModal
        open={isCheckoutOpen && Boolean(pendingCheckoutUrl)}
        checkoutUrl={pendingCheckoutUrl}
        onOpenChange={setIsCheckoutOpen}
      />

      {pendingOrder && (
        <PendingPaymentBanner
          order={pendingOrder}
          checkoutUrl={pendingCheckoutUrl}
          isPolling={isPolling}
          onDismiss={clearPendingOrder}
          onOpenCheckout={pendingCheckoutUrl ? handleOpenCheckout : undefined}
        />
      )}

      <CreditBalanceCard balance={balance ?? 0} />

      <CreditsNonRefundableNotice variant="credits-page" />

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Comprar créditos
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Elige un paquete o define una cantidad personalizada. 1 crédito = 1
            USD. Se usan al agregar ubicaciones en tus promociones.
          </p>
        </div>
        <CreditPacksGrid
          packs={packs}
          purchasingPackId={purchasingPackId}
          disabled={isPurchasingCustom}
          showCustomOption={Boolean(customPurchase?.enabled)}
          onPurchase={handlePurchase}
          onCustomClick={() => setIsCustomModalOpen(true)}
        />
      </section>

      {customPurchase?.enabled && (
        <CustomCreditPurchaseModal
          open={isCustomModalOpen}
          onOpenChange={setIsCustomModalOpen}
          settings={customPurchase}
          isPurchasing={isPurchasingCustom}
          onPurchase={handleCustomPurchase}
        />
      )}

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Historial</h2>
        <CreditTransactionsTable items={transactions} />
      </section>
    </div>
  )
}
