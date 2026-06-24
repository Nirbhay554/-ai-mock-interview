# AI Mock Interview Platform

Full-stack AI-powered interview platform with voice support.

## Stack
- **Frontend**: React + Vite → Vercel
- **Backend**: Node.js + Express → Render
- **AI**: Gemini 1.5 Flash (free tier)
- **Auth + DB**: Supabase (Google OAuth + Postgres)
- **Voice**: Web Speech API (browser-native, free)

---

## Setup Guide

### Step 1 — Supabase
1. Go to https://supabase.com → create new project
2. Go to **SQL Editor** → paste contents of `backend/supabase_schema.sql` → Run
3. Go to **Authentication → Providers → Google** → enable it
   - Add your Google OAuth credentials (from Google Cloud Console)
4. Copy your **Project URL** and **anon key** (Settings → API)
5. Copy your **service_role key** (Settings → API → keep this secret!)

### Step 2 — Backend
```bash
cd backend
cp .env.example .env
# Fill in GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev   # runs on http://localhost:5000
```

### Step 3 — Frontend
```bash
cd frontend
cp .env.example .env
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL
npm install
npm run dev   # runs on http://localhost:5173
```

### Step 4 — Deploy
- **Frontend**: Push to GitHub → import in Vercel → add env vars
- **Backend**: Push to GitHub → import in Render → add env vars → set FRONTEND_URL to your Vercel URL

---

## How to View User Data (Admin)
Go to **Supabase Dashboard → Table Editor**:
- `sessions` table: all interviews, scores, summaries
- `messages` table: every Q&A, voice flag, per-answer scores

---

## Security Features
- JWT auth on every backend route
- Row Level Security (RLS) in Supabase
- Rate limiting (20 req/min per IP)
- Daily session limit (3/user/day)
- Input sanitization + prompt injection blocking
- CORS locked to frontend domain only
- API keys never exposed to frontend
