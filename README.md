# HUCK — AI Freight Negotiator

HUCK is a multimodal AI dispatch tool that automates freight rate negotiation. It scrapes load listings from DAT, syncs driver data from Motive, ranks loads against your fleet, and deploys a voice AI agent to call brokers and negotiate rates — then summarizes every call with AI.

**Four modalities in one flow:** Vision (screenshot parsing) + Data (spot rate analysis) + Voice (AI broker calls) + Text (Gemini transcript summaries)

## Architecture

```
Motive (Fleet)  →  HUCK Dashboard  ←  DAT (Load Board)
                       ↓
                  Rate Engine
               (posted vs spot)
                       ↓
                   VAPI Voice AI
               (calls the broker)
                       ↓
               Gemini Transcript
                  Summarizer
                       ↓
                 Outcome + Logs
```

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), Tailwind CSS, Lucide Icons |
| Backend | InsForge (Postgres BaaS — database, auth, storage) |
| Voice AI | VAPI (outbound calls, tool-calling assistant) |
| Vision | OpenRouter via InsForge AI (DAT screenshot parsing) |
| Summarization | Google Gemini 2.0 Flash (transcript analysis) |
| Auth | Google OAuth via InsForge |
| Maps | Leaflet + React-Leaflet (driver/load visualization) |

## Pages

| Route | Description |
|-------|-------------|
| `/` | **HUCK Dashboard** — Main hub. Rank loads by driver proximity/cost, one-click negotiate, view call outcomes. |
| `/loadboard` | **DAT One** (simulated) — Load board with search/filters. HUCK extension overlay syncs listings. |
| `/motive` | **Motive** (simulated) — Fleet management with driver locations, HOS, equipment. Sync button pushes fleet data to HUCK. |
| `/login` | Google OAuth sign-in |
| `/calls` | Call history with transcripts, summaries, and outcomes |
| `/upload` | Upload DAT screenshots for AI-powered load extraction |
| `/map` | Leaflet map with driver locations and load origins |

## Demo Flow

1. **Sign in** with Google at `/login`
2. **Sync fleet** — Go to `/motive`, click "Sync Fleet to HUCK"
3. **Sync loads** — Go to `/loadboard`, click "Sync to HUCK" in the extension overlay
4. **Rank loads** — Back on HUCK (`/`), click **"Rank Based on My Drivers"** — matches drivers to loads by equipment compatibility, deadhead distance, and cost efficiency
5. **Negotiate** — Click **Negotiate** on any listing. HUCK's voice AI calls the broker to accept or negotiate the posted rate
6. **Role-play** — Answer the call as the broker. Accept, counter, or reject
7. **Review** — Check Negotiating tab for live call status, Confirmed tab for deals. Gemini auto-summarizes every transcript

> All broker phone numbers in seed data point to your own number for demo purposes.

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/collect-listings` | POST | Marks DAT loads as collected (synced to HUCK) |
| `/api/assign-drivers` | POST | Ranks and assigns drivers to loads by equipment, proximity, and cost |
| `/api/dispatch-single` | POST | Initiates a VAPI voice call for a single load |
| `/api/vapi-webhook` | POST | Handles VAPI tool calls during conversation (accept_load, counter_offer, defer_to_team) |
| `/api/vapi-status` | POST | End-of-call reports. Detects acceptance from transcript. Triggers Gemini summary |
| `/api/summarize-call` | POST | Gemini-powered transcript analysis — extracts rates, offers, outcome, sentiment |
| `/api/parse-image` | POST | Vision AI — extracts structured load data from DAT screenshots |
| `/api/loads` | GET | List loads |
| `/api/drivers` | GET | List drivers |
| `/api/call-logs` | GET | List call logs |

## Rate Engine

`src/lib/rate-engine.ts` — Compares posted rate against lane spot rates:

- **Posted >= Spot High** → `accept` (take it immediately)
- **Posted >= Spot Avg** → `accept`
- **Posted < Spot Avg** → `negotiate` (target = spot average rate)

## Driver Ranking Algorithm

`/api/assign-drivers` scores each driver-load pair:

1. **Equipment match** — Dry Van ↔ Dry Van, Flatbed ↔ Step Deck, etc.
2. **Deadhead distance** — Haversine from driver location to load origin
3. **Cost efficiency** — Posted rate / (deadhead + load miles)
4. **Spot premium** — Bonus for lanes priced below spot average
5. **HOS filter** — Minimum 4 hours remaining

Best-paying loads get first pick of drivers. Each driver assigned once.

## Database Tables

| Table | Purpose |
|-------|---------|
| `drivers` | Fleet data (name, location, HOS, equipment, availability) |
| `loads` | Load listings (origin/dest, rate, broker, equipment, status, assigned_driver_id) |
| `spot_rates` | Market rates per lane (avg, high, low by equipment type) |
| `call_logs` | Every VAPI call (strategy, rates, outcome, transcript, summary) |
| `accepted_loads` | Confirmed deals |
| `image_uploads` | Uploaded screenshots and parsed data |

## Environment Variables

```bash
# InsForge
NEXT_PUBLIC_INSFORGE_URL=
NEXT_PUBLIC_INSFORGE_ANON_KEY=
INSFORGE_API_KEY=

# VAPI Voice AI
VAPI_API_KEY=
VAPI_ASSISTANT_ID=
VAPI_PHONE_NUMBER_ID=

# Google Gemini
GEMINI_API_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Setup

```bash
npm install
cp .env.example .env.local  # Fill in credentials
npm run dev
```

For VAPI webhooks, expose localhost:

```bash
ngrok http 3000
# Update VAPI assistant server URL to ngrok domain
```

## Fleet (Seed Data)

| Driver | Base | Equipment |
|--------|------|-----------|
| Dawit Tesfaye | Atlanta, GA | Dry Van |
| Gurpreet Singh | Dallas, TX | Reefer |
| Bobby Ray Crawford | Memphis, TN | Dry Van |
| Andrey Petrov | Chicago, IL | Dry Van |
| Miguel Contreras | Los Angeles, CA | Flatbed |
