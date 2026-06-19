'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import type { Driver, Load } from '@/lib/types'

const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
)
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
)
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
)
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
)
const Polyline = dynamic(
  () => import('react-leaflet').then((mod) => mod.Polyline),
  { ssr: false }
)

export default function MapPage() {
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loads, setLoads] = useState<Load[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    Promise.all([
      fetch('/api/drivers').then((r) => r.json()),
      fetch('/api/loads?status=available').then((r) => r.json()),
    ]).then(([d, l]) => {
      if (Array.isArray(d)) setDrivers(d)
      if (Array.isArray(l)) setLoads(l)
    })
  }, [])

  if (!mounted) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-white mb-6">Fleet Map</h2>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 h-[600px] flex items-center justify-center">
          <p className="text-gray-500">Loading map...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-6">Fleet Map</h2>

      <div className="rounded-xl border border-gray-800 overflow-hidden h-[600px]">
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        />
        <MapContainer
          center={[39.0, -98.0]}
          zoom={4}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {/* Driver markers */}
          {drivers.map((driver) => (
            <Marker
              key={`driver-${driver.id}`}
              position={[driver.current_lat, driver.current_lng]}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-bold">{driver.name}</p>
                  <p>{driver.truck_type} - {driver.trailer_type}</p>
                  <p>HOS: {driver.hos_remaining_hours}h remaining</p>
                  <p>{driver.current_city}, {driver.current_state}</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Load markers */}
          {loads.map((load) => (
            <Marker
              key={`load-${load.id}`}
              position={[load.origin_lat, load.origin_lng]}
            >
              <Popup>
                <div className="text-sm">
                  <p className="font-bold">
                    {load.origin_city}, {load.origin_state} → {load.dest_city}, {load.dest_state}
                  </p>
                  <p>Rate: ${Number(load.posted_rate).toLocaleString()} (${load.rate_per_mile}/mi)</p>
                  <p>Broker: {load.broker_name}</p>
                  <p>Equipment: {load.equipment_type}</p>
                  <p>Pickup: {load.pickup_date}</p>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* Polylines from loads origin to destination */}
          {loads.map((load) => (
            <Polyline
              key={`line-${load.id}`}
              positions={[
                [load.origin_lat, load.origin_lng],
                [load.dest_lat, load.dest_lng],
              ]}
              pathOptions={{ color: '#f59e0b', weight: 1, opacity: 0.4, dashArray: '5 10' }}
            />
          ))}
        </MapContainer>
      </div>

      <div className="mt-4 flex items-center gap-6 text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-blue-500" />
          Drivers ({drivers.length})
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-amber-500" />
          Available Loads ({loads.length})
        </div>
      </div>
    </div>
  )
}
