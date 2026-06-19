import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/insforge'
import { openai } from '@/lib/openai'

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const uploadType = formData.get('upload_type') as string || 'dat_screenshot'
  const driverId = formData.get('driver_id') as string | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
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

  // Convert file to base64 for vision model
  const bytes = await file.arrayBuffer()
  const base64 = Buffer.from(bytes).toString('base64')
  const mimeType = file.type || 'image/png'

  // Send to Gemini via OpenRouter for vision extraction
  const systemPrompt = uploadType === 'dat_screenshot'
    ? `You are a freight load data extractor. Extract structured data from this DAT load board screenshot. Return ONLY valid JSON (no markdown, no code fences) with an array of loads, each having: origin_city, origin_state, dest_city, dest_state, posted_rate (number), rate_per_mile (number), broker_name, broker_phone, equipment_type, weight (number in lbs), miles (number), pickup_date (YYYY-MM-DD format). If you cannot determine a field, use reasonable defaults. For pickup_date, use tomorrow's date if unclear.`
    : uploadType === 'bol'
    ? `You are a Bill of Lading data extractor. Extract structured data from this BOL document. Return ONLY valid JSON (no markdown, no code fences) with: shipper_name, shipper_address, consignee_name, consignee_address, carrier_name, pro_number, bol_number, pieces, weight, description, special_instructions.`
    : `You are a rate confirmation data extractor. Extract structured data from this rate confirmation document. Return ONLY valid JSON (no markdown, no code fences) with: broker_name, carrier_name, load_number, origin, destination, rate, pickup_date, delivery_date, equipment_type, special_instructions.`

  try {
    const completion = await openai.chat.completions.create({
      model: 'google/gemini-2.0-flash-001',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
            { type: 'text', text: 'Extract all load/document data from this image.' },
          ],
        },
      ],
      max_tokens: 2000,
    })

    const rawResponse = completion.choices[0]?.message?.content || '{}'

    // Parse JSON from the response, stripping any markdown fences
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
      const loadsToInsert = (parsedData as Record<string, unknown>[]).map((load) => ({
        origin_city: String(load.origin_city || 'Unknown'),
        origin_state: String(load.origin_state || 'XX'),
        origin_lat: 33.749,
        origin_lng: -84.388,
        dest_city: String(load.dest_city || 'Unknown'),
        dest_state: String(load.dest_state || 'XX'),
        dest_lat: 32.777,
        dest_lng: -96.797,
        posted_rate: Number(load.posted_rate) || 0,
        rate_per_mile: Number(load.rate_per_mile) || 0,
        broker_name: String(load.broker_name || 'Unknown Broker'),
        broker_phone: String(load.broker_phone || '555-0000'),
        equipment_type: String(load.equipment_type || 'Dry Van'),
        weight: Number(load.weight) || 40000,
        miles: Number(load.miles) || 0,
        pickup_date: String(load.pickup_date || new Date(Date.now() + 86400000).toISOString().split('T')[0]),
        status: 'available',
        source: 'Screenshot Upload',
      }))

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
