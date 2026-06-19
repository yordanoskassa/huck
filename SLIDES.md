---
marp: true
theme: uncover
class: invert
paginate: true
backgroundColor: #0b0d10
color: #f3f4f6
style: |
  section { font-family: 'Geist', system-ui, sans-serif; }
  h1, h2 { color: #10b981; letter-spacing: -0.02em; }
  strong { color: #10b981; }
  code { background: #1f2937; color: #6ee7b7; }
  table { font-size: 0.78em; }
  a { color: #34d399; }
---

<!-- _paginate: false -->

# 1. HUCK

## AI Freight Negotiator

**Vision + Data + Voice + Text** in one dispatch workflow.

HUCK syncs freight listings, ranks loads against live fleet data, calls brokers with a voice AI agent, and summarizes every negotiation.

`Next.js 16` · `React 19` · `InsForge` · `VAPI` · `Gemini`

---

# 2. The Problem

Freight dispatch is still too manual.

| Workflow | Today | Impact |
|---|---|---|
| Broker calls | One-by-one phone work | Slow throughput |
| Rate decisions | Gut feel vs. market | Margin leakage |
| Driver matching | Manual spreadsheet logic | Empty miles |
| Call notes | Incomplete records | No learning loop |

**A dispatcher can only be on one call at a time. HUCK can scale the loop.**

---

# 3. The Product

HUCK automates the full negotiation cycle:

- **Vision**: extract DAT screenshots into structured loads
- **Data**: compare posted rates against spot rates and driver fit
- **Voice**: call brokers through VAPI to accept, counter, or defer
- **Text**: summarize transcripts into outcomes, rates, and next steps

**One click: rank, call, negotiate, log, and review.**

---

# 4. How It Works

```text
Motive Fleet  --->  HUCK Dashboard  <---  DAT Load Board
                         |
                         v
                   Rate + Driver Engine
                         |
                         v
                    VAPI Voice Agent
                         |
                         v
                 Gemini Summary + Logs
```

The rate engine decides the strategy. The voice agent executes it. The dashboard keeps the operator in control.

---

# 5. Status + Demo

| Area | Status |
|---|---|
| Auth + backend | InsForge auth, Postgres, storage, API routes |
| UI | Unified dark emerald operations dashboard |
| Tables | TanStack-powered load, call, driver, vehicle views |
| Maps | Leaflet fleet/load map |
| AI | Gemini parsing and summaries, VAPI outbound calls |

Demo flow:

`Sign in -> Sync fleet -> Sync loads -> Rank drivers -> Negotiate -> Review outcome`

Run locally:

```bash
npm run dev
```
