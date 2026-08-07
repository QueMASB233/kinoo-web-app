"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { setOptions, importLibrary } from "@googlemaps/js-api-loader"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  CITY_COVERAGE_RADIUS_M,
  POINT_COVERAGE_RADIUS_M,
} from "@/lib/geo-coverage"
import { MapPin, Loader2 } from "lucide-react"
import type { PromotionLocation } from "@/types"

const DEFAULT_CENTER = { lat: -1.4386, lng: -78.3885 }
const DEFAULT_COUNTRY_ZOOM = 7
const POINT_COLOR = "#FF6B35"
const CITY_COLOR = "#4A90D9"

let googleMapsInitialized = false

interface AdminReviewLocationsMapProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  locations: PromotionLocation[]
}

export function AdminReviewLocationsMap({
  open,
  onOpenChange,
  title,
  locations,
}: AdminReviewLocationsMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const overlaysRef = useRef<Array<google.maps.Marker | google.maps.Circle>>([])
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)

  const clearOverlays = useCallback(() => {
    for (const overlay of overlaysRef.current) {
      overlay.setMap(null)
    }
    overlaysRef.current = []
  }, [])

  const drawLocations = useCallback(() => {
    const map = mapInstanceRef.current
    if (!map || !mapReady) return

    clearOverlays()

    if (locations.length === 0) {
      map.setCenter(DEFAULT_CENTER)
      map.setZoom(DEFAULT_COUNTRY_ZOOM)
      return
    }

    const bounds = new google.maps.LatLngBounds()

    for (const loc of locations) {
      const isCity = loc.coverage_type === "city"
      const position = { lat: loc.place.lat, lng: loc.place.lng }
      const color = isCity ? CITY_COLOR : POINT_COLOR
      const radius = isCity
        ? CITY_COVERAGE_RADIUS_M
        : POINT_COVERAGE_RADIUS_M

      const marker = new google.maps.Marker({
        map,
        position,
        title: loc.place.address || undefined,
      })

      const circle = new google.maps.Circle({
        map,
        center: position,
        radius,
        fillColor: color,
        fillOpacity: isCity ? 0.12 : 0.2,
        strokeColor: color,
        strokeOpacity: 0.45,
        strokeWeight: 2,
        clickable: false,
      })

      overlaysRef.current.push(marker, circle)
      bounds.union(circle.getBounds()!)
    }

    map.fitBounds(bounds, 48)
  }, [clearOverlays, locations, mapReady])

  useEffect(() => {
    if (!open) {
      clearOverlays()
      mapInstanceRef.current = null
      setMapReady(false)
      setMapError(null)
      return
    }

    let cancelled = false

    async function initMap() {
      if (!mapRef.current) return

      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      if (!apiKey) {
        setMapError("Falta configurar NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")
        return
      }

      try {
        if (!googleMapsInitialized) {
          setOptions({ key: apiKey, v: "weekly" })
          googleMapsInitialized = true
        }

        await importLibrary("maps")
        await importLibrary("marker")

        if (cancelled || !mapRef.current) return

        mapInstanceRef.current = new google.maps.Map(mapRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_COUNTRY_ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        })
        setMapReady(true)
      } catch {
        if (!cancelled) {
          setMapError("No se pudo cargar el mapa")
        }
      }
    }

    // Espera un tick para que el Dialog monte el contenedor.
    const t = window.setTimeout(() => {
      void initMap()
    }, 50)

    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [clearOverlays, open])

  useEffect(() => {
    if (open && mapReady) {
      drawLocations()
    }
  }, [drawLocations, mapReady, open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-3">
        <DialogHeader>
          <DialogTitle className="pr-8 text-base">Ubicaciones</DialogTitle>
          <DialogDescription className="text-xs">
            {title} · Solo lectura ·{" "}
            {locations.length === 0
              ? "Sin ubicaciones"
              : `${locations.length} ubicación${locations.length !== 1 ? "es" : ""}`}
          </DialogDescription>
        </DialogHeader>

        {locations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-4 py-10 text-center">
            <MapPin className="h-8 w-8 text-amber-500" />
            <p className="mt-3 text-sm font-medium text-amber-900">
              Sin ubicaciones
            </p>
            <p className="mt-1 max-w-sm text-xs text-amber-800">
              Si apruebas esta publicación, no se mostrará en la app hasta que
              el proveedor agregue al menos un punto o ciudad.
            </p>
          </div>
        ) : (
          <>
            <div className="relative h-[360px] w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              {!mapReady && !mapError && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-50/80">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
              )}
              {mapError ? (
                <div className="flex h-full items-center justify-center px-4 text-center text-sm text-red-600">
                  {mapError}
                </div>
              ) : (
                <div ref={mapRef} className="h-full w-full" />
              )}
            </div>

            <ul className="max-h-40 space-y-1.5 overflow-y-auto text-xs">
              {locations.map((loc) => {
                const isCity = loc.coverage_type === "city"
                return (
                  <li
                    key={loc.id}
                    className="flex items-start gap-2 rounded-md border border-gray-100 px-2.5 py-2"
                  >
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-gray-800">
                        {loc.place.address || "Sin dirección"}
                      </p>
                      <p className="truncate text-gray-500">
                        {[loc.place.city, loc.place.country]
                          .filter(Boolean)
                          .join(", ") || "—"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        isCity
                          ? "bg-[#4A90D9]/15 text-[#4A90D9]"
                          : "bg-[#FF6B35]/15 text-[#FF6B35]"
                      }`}
                    >
                      {isCity ? "Ciudad (25 km)" : "Punto (1 km)"}
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
