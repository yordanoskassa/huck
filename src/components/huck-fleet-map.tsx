'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Driver, Load } from '@/lib/types'

interface HuckFleetMapProps {
  drivers: Driver[]
  loads: Load[]
  highlightedLoadId?: string | null
  showAssignments?: boolean
  className?: string
}

function truckIcon(active: boolean) {
  return L.divIcon({
    className: 'driver-marker',
    html: `
      <div style="
        display:flex;align-items:center;justify-content:center;
        width:38px;height:38px;border-radius:50%;
        background:${active ? '#1a56db' : '#9ca3af'};
        border:3px solid white;
        box-shadow:0 2px 10px rgba(26,86,219,0.35);
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
          <path d="M15 18H9"/>
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
          <circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>
        </svg>
      </div>`,
    iconSize: [38, 38],
    iconAnchor: [19, 19],
    popupAnchor: [0, -22],
  })
}

function dotIcon(color: string, size = 14, pulse = false) {
  return L.divIcon({
    className: 'load-marker',
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;">
        ${pulse ? `<div style="position:absolute;inset:-6px;border-radius:50%;background:${color};opacity:0.25;animation:pulse 2s infinite;"></div>` : ''}
        <div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 6px rgba(0,0,0,0.25);"></div>
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export default function HuckFleetMap({
  drivers,
  loads,
  highlightedLoadId,
  showAssignments = true,
  className = '',
}: HuckFleetMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const overlayRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return

    const map = L.map(mapRef.current, {
      center: [39, -98],
      zoom: 4,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19,
    }).addTo(map)

    overlayRef.current = L.layerGroup().addTo(map)
    mapInstance.current = map

    return () => {
      map.remove()
      mapInstance.current = null
      overlayRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapInstance.current
    const overlay = overlayRef.current
    if (!map || !overlay) return

    overlay.clearLayers()
    const bounds: L.LatLngExpression[] = []

    drivers.forEach((driver) => {
      if (!driver.current_lat || !driver.current_lng) return
      bounds.push([driver.current_lat, driver.current_lng])

      const hosPct = driver.hos_remaining_hours / 11
      const hosColor = hosPct > 0.5 ? '#16a34a' : hosPct > 0.25 ? '#eab308' : '#dc2626'

      L.marker([driver.current_lat, driver.current_lng], {
        icon: truckIcon(driver.available),
        zIndexOffset: 1000,
      })
        .bindPopup(`
          <div style="font-family:system-ui,sans-serif;min-width:210px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <div style="width:28px;height:28px;border-radius:8px;background:#1a56db;display:flex;align-items:center;justify-content:center;">
                <svg width="14" height="14" viewBox="0 0 32 32" fill="none"><path d="M4 26V8L10 18L16 8L22 18L28 8V26" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
              <div>
                <div style="font-weight:700;font-size:14px;color:#111827;">${driver.name}</div>
                <div style="font-size:11px;color:#6b7280;">Motive ELD &middot; ${driver.current_city}, ${driver.current_state}</div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;">
              <div style="background:#f9fafb;padding:6px 8px;border-radius:6px;">
                <div style="color:#6b7280;font-size:9px;text-transform:uppercase;font-weight:700;">Trailer</div>
                <div style="font-weight:600;">${driver.trailer_type}</div>
              </div>
              <div style="background:#f9fafb;padding:6px 8px;border-radius:6px;">
                <div style="color:#6b7280;font-size:9px;text-transform:uppercase;font-weight:700;">HOS</div>
                <div style="font-weight:700;color:${hosColor};">${driver.hos_remaining_hours.toFixed(1)}h</div>
              </div>
            </div>
          </div>`, { maxWidth: 280 })
        .addTo(overlay)
    })

    loads.forEach((load) => {
      if (!load.origin_lat || !load.origin_lng || !load.dest_lat || !load.dest_lng) return

      const isHighlighted = highlightedLoadId === load.id
      const isDispatching = load.status === 'dispatching'
      const isAccepted = load.status === 'accepted'
      const routeColor = isAccepted ? '#059669' : isDispatching ? '#d97706' : isHighlighted ? '#10b981' : '#94a3b8'
      const routeWeight = isHighlighted || isDispatching ? 3 : 2
      const routeOpacity = isHighlighted ? 0.85 : 0.45

      bounds.push([load.origin_lat, load.origin_lng], [load.dest_lat, load.dest_lng])

      L.polyline(
        [[load.origin_lat, load.origin_lng], [load.dest_lat, load.dest_lng]],
        { color: routeColor, weight: routeWeight, opacity: routeOpacity, dashArray: isAccepted ? undefined : '8 6' },
      ).addTo(overlay)

      L.marker([load.origin_lat, load.origin_lng], {
        icon: dotIcon(isAccepted ? '#059669' : '#10b981', isHighlighted ? 16 : 12, isDispatching),
      })
        .bindPopup(`
          <div style="font-family:system-ui,sans-serif;min-width:200px;">
            <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${load.origin_city}, ${load.origin_state} → ${load.dest_city}, ${load.dest_state}</div>
            <div style="font-size:12px;color:#059669;font-weight:700;">$${Number(load.posted_rate).toLocaleString()} · ${load.miles} mi</div>
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">${load.broker_name} · ${load.equipment_type}</div>
          </div>`, { maxWidth: 260 })
        .addTo(overlay)

      L.marker([load.dest_lat, load.dest_lng], {
        icon: dotIcon('#f59e0b', 10),
      }).addTo(overlay)

      if (showAssignments && load.assigned_driver_id) {
        const driver = drivers.find((d) => d.id === load.assigned_driver_id)
        if (driver?.current_lat && driver.current_lng) {
          L.polyline(
            [[driver.current_lat, driver.current_lng], [load.origin_lat, load.origin_lng]],
            { color: '#1a56db', weight: 2, opacity: 0.6, dashArray: '4 8' },
          ).addTo(overlay)
        }
      }
    })

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [48, 48], maxZoom: 6 })
    }
  }, [drivers, loads, highlightedLoadId, showAssignments])

  return (
    <div className={`relative overflow-hidden rounded-xl border border-gray-200 bg-white ${className}`}>
      <style>{`@keyframes pulse { 0%,100%{transform:scale(1);opacity:.25} 50%{transform:scale(1.6);opacity:0} }`}</style>
      <div className="absolute top-3 left-3 z-[1000] flex items-center gap-2">
        <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm rounded-lg border border-gray-200 px-3 py-1.5 shadow-sm">
          <svg width="16" height="16" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path d="M4 26V8L10 18L16 8L22 18L28 8V26" stroke="#1a56db" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-xs font-bold text-gray-700">Motive Live Fleet</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </div>
      <div className="absolute bottom-3 right-3 z-[1000] flex items-center gap-3 bg-white/95 backdrop-blur-sm rounded-lg border border-gray-200 px-3 py-2 shadow-sm text-[10px] font-semibold text-gray-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#1a56db]" /> Drivers</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Pickup</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Delivery</span>
        <span className="flex items-center gap-1.5"><span className="h-4 w-4 border-t-2 border-dashed border-[#1a56db]" /> Deadhead</span>
      </div>
      <div ref={mapRef} className="w-full h-full min-h-[380px]" />
    </div>
  )
}
