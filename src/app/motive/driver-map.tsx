'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Driver } from '@/lib/types'

interface DriverMapProps {
  drivers: Driver[]
}

export default function DriverMap({ drivers }: DriverMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    const map = L.map(mapRef.current, {
      center: [35.5, -95],
      zoom: 5,
      zoomControl: true,
    })

    // CARTO dark basemap to match the app's dark design system.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map)

    mapInstance.current = map

    return () => {
      map.remove()
      mapInstance.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapInstance.current
    if (!map || drivers.length === 0) return

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) map.removeLayer(layer)
    })

    drivers.forEach((driver) => {
      if (!driver.current_lat || !driver.current_lng) return

      const isActive = driver.available
      const hosPct = driver.hos_remaining_hours / 11
      const hosColor =
        hosPct > 0.5
          ? 'var(--success)'
          : hosPct > 0.25
            ? 'var(--warning)'
            : 'var(--destructive)'

      // Create a custom truck icon
      const icon = L.divIcon({
        className: 'driver-marker',
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: ${isActive ? 'var(--primary)' : 'var(--muted-foreground)'};
            border: 3px solid var(--background);
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
            color: var(--primary-foreground);
            font-size: 16px;
          ">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${isActive ? 'var(--primary-foreground)' : 'var(--background)'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
              <path d="M15 18H9"/>
              <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
              <circle cx="17" cy="18" r="2"/>
              <circle cx="7" cy="18" r="2"/>
            </svg>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -20],
      })

      const marker = L.marker([driver.current_lat, driver.current_lng], { icon }).addTo(map)

      marker.bindPopup(`
        <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 200px; color: var(--popover-foreground);">
          <div style="font-weight: 700; font-size: 14px; margin-bottom: 4px; color: var(--foreground);">${driver.name}</div>
          <div style="font-size: 12px; color: var(--muted-foreground); margin-bottom: 8px;">
            ${driver.current_city}, ${driver.current_state}
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px;">
            <div style="background: var(--muted); padding: 6px 8px; border-radius: 6px;">
              <div style="color: var(--muted-foreground); font-size: 10px; text-transform: uppercase; font-weight: 700;">Truck</div>
              <div style="color: var(--foreground); font-weight: 600;">${driver.truck_type}</div>
            </div>
            <div style="background: var(--muted); padding: 6px 8px; border-radius: 6px;">
              <div style="color: var(--muted-foreground); font-size: 10px; text-transform: uppercase; font-weight: 700;">Trailer</div>
              <div style="color: var(--foreground); font-weight: 600;">${driver.trailer_type}</div>
            </div>
            <div style="background: var(--muted); padding: 6px 8px; border-radius: 6px;">
              <div style="color: var(--muted-foreground); font-size: 10px; text-transform: uppercase; font-weight: 700;">HOS Left</div>
              <div style="color: ${hosColor}; font-weight: 700;">${driver.hos_remaining_hours.toFixed(1)}h / 11h</div>
            </div>
            <div style="background: var(--muted); padding: 6px 8px; border-radius: 6px;">
              <div style="color: var(--muted-foreground); font-size: 10px; text-transform: uppercase; font-weight: 700;">Status</div>
              <div style="color: ${isActive ? 'var(--success)' : 'var(--muted-foreground)'}; font-weight: 700;">${isActive ? 'Active' : 'Off Duty'}</div>
            </div>
          </div>
          <div style="margin-top: 8px; font-size: 11px; color: var(--muted-foreground);">
            MC# ${driver.mc_number} &middot; ${driver.phone}
          </div>
        </div>
      `, { maxWidth: 280 })
    })

    // Fit bounds to all drivers
    const validDrivers = drivers.filter((d) => d.current_lat && d.current_lng)
    if (validDrivers.length > 0) {
      const bounds = L.latLngBounds(validDrivers.map((d) => [d.current_lat, d.current_lng]))
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 7 })
    }
  }, [drivers])

  return <div ref={mapRef} className="w-full h-full" />
}
