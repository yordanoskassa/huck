export interface Driver {
  id: string
  name: string
  current_city: string
  current_state: string
  current_lat: number
  current_lng: number
  hos_remaining_hours: number
  truck_type: string
  trailer_type: string
  available: boolean
  mc_number: string
  phone: string
  created_at: string
}

export interface Load {
  id: string
  origin_city: string
  origin_state: string
  origin_lat: number
  origin_lng: number
  dest_city: string
  dest_state: string
  dest_lat: number
  dest_lng: number
  posted_rate: number
  rate_per_mile: number
  broker_name: string
  broker_phone: string
  equipment_type: string
  weight: number
  miles: number
  pickup_date: string
  status: 'available' | 'dispatching' | 'accepted' | 'rejected' | 'expired'
  source: string
  created_at: string
}

export interface SpotRate {
  id: string
  origin_city: string
  origin_state: string
  dest_city: string
  dest_state: string
  equipment_type: string
  rate_per_mile: number
  avg_rate: number
  high_rate: number
  low_rate: number
}

export interface CallLog {
  id: string
  load_id: string
  driver_id: string
  vapi_call_id: string | null
  strategy: 'accept' | 'negotiate'
  offered_rate: number
  counter_offer_rate: number | null
  final_rate: number | null
  outcome: 'pending' | 'in_progress' | 'accepted' | 'rejected' | 'voicemail' | 'no_answer' | 'error'
  transcript: string | null
  recording_url: string | null
  summary: string | null
  duration_seconds: number | null
  started_at: string
  ended_at: string | null
  created_at: string
  // joined fields
  load?: Load
  driver?: Driver
}

export interface AcceptedLoad {
  id: string
  load_id: string
  driver_id: string
  call_log_id: string
  final_rate: number
  pickup_date: string
  status: 'confirmed' | 'in_transit' | 'delivered'
  created_at: string
}

export interface ImageUpload {
  id: string
  driver_id: string | null
  image_url: string
  image_key: string
  parsed_data: Record<string, unknown> | null
  upload_type: 'dat_screenshot' | 'bol' | 'rate_confirmation'
  status: 'pending' | 'processing' | 'completed' | 'failed'
  created_at: string
}

export interface DispatchDecision {
  load: Load
  driver: Driver
  spotRate: SpotRate | null
  strategy: 'accept' | 'negotiate'
  targetRate: number
  reason: string
}

export interface VAPIToolCallRequest {
  message: {
    type: string
    toolCallList?: Array<{
      id: string
      type: string
      function: {
        name: string
        arguments: string
      }
    }>
    call?: {
      id: string
    }
    endedReason?: string
    transcript?: string
    recordingUrl?: string
    summary?: string
    durationSeconds?: number
    analysis?: Record<string, unknown>
    artifact?: {
      messages?: Array<{ role: string; content: string }>
      transcript?: string
      recordingUrl?: string
    }
  }
}

export interface VAPIToolCallResponse {
  results: Array<{
    toolCallId: string
    result: string
  }>
}
