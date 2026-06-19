-- Drivers table (simulated Motive data)
CREATE TABLE drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  current_city TEXT NOT NULL,
  current_state TEXT NOT NULL,
  current_lat DOUBLE PRECISION NOT NULL,
  current_lng DOUBLE PRECISION NOT NULL,
  hos_remaining_hours NUMERIC(4,1) NOT NULL DEFAULT 11.0,
  truck_type TEXT NOT NULL DEFAULT 'Semi',
  trailer_type TEXT NOT NULL DEFAULT 'Dry Van',
  available BOOLEAN NOT NULL DEFAULT true,
  mc_number TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Loads table (simulated DAT load board)
CREATE TABLE loads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_city TEXT NOT NULL,
  origin_state TEXT NOT NULL,
  origin_lat DOUBLE PRECISION NOT NULL,
  origin_lng DOUBLE PRECISION NOT NULL,
  dest_city TEXT NOT NULL,
  dest_state TEXT NOT NULL,
  dest_lat DOUBLE PRECISION NOT NULL,
  dest_lng DOUBLE PRECISION NOT NULL,
  posted_rate NUMERIC(10,2) NOT NULL,
  rate_per_mile NUMERIC(6,2) NOT NULL,
  broker_name TEXT NOT NULL,
  broker_phone TEXT NOT NULL,
  equipment_type TEXT NOT NULL DEFAULT 'Dry Van',
  weight INTEGER NOT NULL DEFAULT 40000,
  miles INTEGER NOT NULL,
  pickup_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available','dispatching','accepted','rejected','expired')),
  source TEXT NOT NULL DEFAULT 'DAT',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spot rates table
CREATE TABLE spot_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_city TEXT NOT NULL,
  origin_state TEXT NOT NULL,
  dest_city TEXT NOT NULL,
  dest_state TEXT NOT NULL,
  equipment_type TEXT NOT NULL DEFAULT 'Dry Van',
  rate_per_mile NUMERIC(6,2) NOT NULL,
  avg_rate NUMERIC(10,2) NOT NULL,
  high_rate NUMERIC(10,2) NOT NULL,
  low_rate NUMERIC(10,2) NOT NULL
);

-- Call logs table
CREATE TABLE call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id UUID REFERENCES loads(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  vapi_call_id TEXT,
  strategy TEXT NOT NULL CHECK (strategy IN ('accept','negotiate')),
  offered_rate NUMERIC(10,2) NOT NULL,
  counter_offer_rate NUMERIC(10,2),
  final_rate NUMERIC(10,2),
  outcome TEXT NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending','in_progress','accepted','rejected','voicemail','no_answer','error')),
  transcript TEXT,
  recording_url TEXT,
  summary TEXT,
  duration_seconds INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Accepted loads table
CREATE TABLE accepted_loads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id UUID REFERENCES loads(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
  call_log_id UUID REFERENCES call_logs(id) ON DELETE CASCADE,
  final_rate NUMERIC(10,2) NOT NULL,
  pickup_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','in_transit','delivered')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Image uploads table
CREATE TABLE image_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  image_key TEXT NOT NULL,
  parsed_data JSONB,
  upload_type TEXT NOT NULL CHECK (upload_type IN ('dat_screenshot','bol','rate_confirmation')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_loads_status ON loads(status);
CREATE INDEX idx_loads_origin_dest ON loads(origin_state, dest_state);
CREATE INDEX idx_call_logs_load ON call_logs(load_id);
CREATE INDEX idx_call_logs_outcome ON call_logs(outcome);
CREATE UNIQUE INDEX idx_spot_rates_lane ON spot_rates(origin_city, origin_state, dest_city, dest_state, equipment_type);

-- Enable RLS on all tables
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE spot_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE accepted_loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE image_uploads ENABLE ROW LEVEL SECURITY;

-- Hackathon: allow all for authenticated users
CREATE POLICY "allow_all_drivers" ON drivers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_loads" ON loads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_spot_rates" ON spot_rates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_call_logs" ON call_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_accepted_loads" ON accepted_loads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_image_uploads" ON image_uploads FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Grants
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON drivers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON loads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON spot_rates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON call_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON accepted_loads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON image_uploads TO authenticated;
