import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/insforge'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

// Approximate city coordinates for common US freight hubs
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'Atlanta,GA': { lat: 33.749, lng: -84.388 },
  'Dallas,TX': { lat: 32.777, lng: -96.797 },
  'Chicago,IL': { lat: 41.878, lng: -87.630 },
  'Memphis,TN': { lat: 35.150, lng: -90.049 },
  'Los Angeles,CA': { lat: 34.052, lng: -118.244 },
  'Phoenix,AZ': { lat: 33.449, lng: -112.074 },
  'Houston,TX': { lat: 29.760, lng: -95.370 },
  'Jacksonville,FL': { lat: 30.332, lng: -81.656 },
  'Charlotte,NC': { lat: 35.227, lng: -80.843 },
  'Nashville,TN': { lat: 36.163, lng: -86.781 },
  'Indianapolis,IN': { lat: 39.768, lng: -86.158 },
  'Columbus,OH': { lat: 39.961, lng: -82.999 },
  'Denver,CO': { lat: 39.739, lng: -104.990 },
  'Kansas City,MO': { lat: 39.100, lng: -94.579 },
  'St. Louis,MO': { lat: 38.627, lng: -90.199 },
  'Miami,FL': { lat: 25.762, lng: -80.192 },
  'Savannah,GA': { lat: 32.081, lng: -81.091 },
  'Laredo,TX': { lat: 27.506, lng: -99.507 },
  'El Paso,TX': { lat: 31.762, lng: -106.445 },
  'San Antonio,TX': { lat: 29.425, lng: -98.495 },
  'Birmingham,AL': { lat: 33.521, lng: -86.802 },
  'Louisville,KY': { lat: 38.253, lng: -85.759 },
  'Fresno,CA': { lat: 36.738, lng: -119.785 },
  'Sacramento,CA': { lat: 38.582, lng: -121.494 },
  'San Francisco,CA': { lat: 37.775, lng: -122.419 },
  'Seattle,WA': { lat: 47.606, lng: -122.332 },
  'Portland,OR': { lat: 45.523, lng: -122.677 },
  'Salt Lake City,UT': { lat: 40.761, lng: -111.891 },
  'Albuquerque,NM': { lat: 35.084, lng: -106.651 },
  'Oklahoma City,OK': { lat: 35.468, lng: -97.516 },
  'Omaha,NE': { lat: 41.257, lng: -95.995 },
  'Minneapolis,MN': { lat: 44.978, lng: -93.265 },
  'Detroit,MI': { lat: 42.331, lng: -83.046 },
  'Cleveland,OH': { lat: 41.500, lng: -81.694 },
  'Pittsburgh,PA': { lat: 40.441, lng: -79.990 },
  'Philadelphia,PA': { lat: 39.953, lng: -75.164 },
  'New York,NY': { lat: 40.713, lng: -74.006 },
  'Newark,NJ': { lat: 40.736, lng: -74.172 },
  'Baltimore,MD': { lat: 39.290, lng: -76.612 },
  'Richmond,VA': { lat: 37.541, lng: -77.434 },
  'Raleigh,NC': { lat: 35.780, lng: -78.639 },
}

function getCoords(city: string, state: string): { lat: number; lng: number } {
  const key = `${city},${state}`
  return CITY_COORDS[key] || { lat: 39.8, lng: -98.6 } // US center fallback
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
  }>
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const uploadType = formData.get('upload_type') as string || 'dat_screenshot'
  const driverId = formData.get('driver_id') as string | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
  }

  const admin = createServiceClient()

  // Upload to InsForge Storage
  const { data: uploadData, error: uploadError } = await admin.storage
    .from('uploads')
    .upload(`images/${Date.now()}-${file.name}`, file)

  if (uploadError || !uploadData) {
    return NextResponse.json({ error: uploadError?.message || 'Upload failed' }, { status: 500 })
  }

  // Create image_uploads record
  const { data: record, error: insertError } = await admin.database
    .from('image_uploads')
    .insert([{
      driver_id: driverId,
      image_url: uploadData.url,
      image_key: uploadData.key,
      upload_type: uploadType,
      status: 'processing',
    }])
    .select()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const imageRecord = (record as Record<string, unknown>[])[0]

  // Convert file to base64 for Gemini vision
  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mimeType = file.type || 'image/png'

  const extractionPrompt = uploadType === 'dat_screenshot'
    ? `You are a freight load data extractor. Extract structured data from this DAT load board screenshot. Return ONLY valid JSON (no markdown, no code fences) with an array of loads, each having: origin_city, origin_state, dest_city, dest_state, posted_rate (number), rate_per_mile (number), broker_name, broker_phone, equipment_type, weight (number in lbs), miles (number), pickup_date (YYYY-MM-DD format). If you cannot determine a field, use reasonable defaults. For pickup_date, use tomorrow's date if unclear.`
    : uploadType === 'bol'
    ? `You are a Bill of Lading data extractor. Extract structured data from this BOL document. Return ONLY valid JSON (no markdown, no code fences) with: shipper_name, shipper_address, consignee_name, consignee_address, carrier_name, pro_number, bol_number, pieces, weight, description, special_instructions.`
    : `You are a rate confirmation data extractor. Extract structured data from this rate confirmation document. Return ONLY valid JSON (no markdown, no code fences) with: broker_name, carrier_name, load_number, origin, destination, rate, pickup_date, delivery_date, equipment_type, special_instructions.`

  try {
    // Use Gemini Vision API directly
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: `${extractionPrompt}\n\nExtract all load/document data from this image.` },
          ],
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
      }),
    })

    const geminiData = (await res.json()) as GeminiResponse
    const rawResponse = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

    // Parse JSON from the response
    let parsedData: unknown
    try {
      const cleaned = rawResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsedData = JSON.parse(cleaned)
    } catch {
      parsedData = { raw_text: rawResponse }
    }

    // Update image_uploads record
    await admin.database
      .from('image_uploads')
      .update({ parsed_data: parsedData, status: 'completed' })
      .eq('id', imageRecord.id)

    // If DAT screenshot, create loads from parsed data
    let createdLoads: unknown[] = []
    if (uploadType === 'dat_screenshot' && Array.isArray(parsedData)) {
      const loadsToInsert = (parsedData as Record<string, unknown>[]).map((load) => {
        const originCoords = getCoords(String(load.origin_city || ''), String(load.origin_state || ''))
        const destCoords = getCoords(String(load.dest_city || ''), String(load.dest_state || ''))
        return {
          origin_city: String(load.origin_city || 'Unknown'),
          origin_state: String(load.origin_state || 'XX'),
          origin_lat: originCoords.lat,
          origin_lng: originCoords.lng,
          dest_city: String(load.dest_city || 'Unknown'),
          dest_state: String(load.dest_state || 'XX'),
          dest_lat: destCoords.lat,
          dest_lng: destCoords.lng,
          posted_rate: Number(load.posted_rate) || 0,
          rate_per_mile: Number(load.rate_per_mile) || 0,
          broker_name: String(load.broker_name || 'Unknown Broker'),
          broker_phone: String(load.broker_phone || '555-0000'),
          equipment_type: String(load.equipment_type || 'Dry Van'),
          weight: Number(load.weight) || 40000,
          miles: Number(load.miles) || 0,
          pickup_date: String(load.pickup_date || new Date(Date.now() + 86400000).toISOString().split('T')[0]),
          status: 'available',
          collected: true,
          source: 'screenshot',
        }
      })

      if (loadsToInsert.length > 0) {
        const { data: newLoads } = await admin.database
          .from('loads')
          .insert(loadsToInsert)
          .select()
        createdLoads = newLoads || []
      }
    }

    return NextResponse.json({
      upload: imageRecord,
      parsed_data: parsedData,
      created_loads: createdLoads,
    })
  } catch (aiError) {
    await admin.database
      .from('image_uploads')
      .update({ status: 'failed' })
      .eq('id', imageRecord.id)

    return NextResponse.json(
      { error: 'AI parsing failed', details: String(aiError) },
      { status: 500 }
    )
  }
}
