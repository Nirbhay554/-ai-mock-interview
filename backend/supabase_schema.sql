-- ─────────────────────────────────────────────────────────────────────────────
-- AI MOCK INTERVIEW PLATFORM — Supabase Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. SESSIONS TABLE
-- One row per interview attempt
CREATE TABLE sessions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('Frontend', 'Backend', 'DSA', 'System Design', 'Full Stack')),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  overall_score INTEGER CHECK (overall_score BETWEEN 1 AND 10),
  strengths     TEXT[],
  weaknesses    TEXT[],
  summary       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  completed_at  TIMESTAMPTZ
);

-- 2. MESSAGES TABLE
-- Every Q&A exchange in a session
CREATE TABLE messages (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id      UUID REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('agent', 'user')),
  content         TEXT NOT NULL,           -- the message text
  is_voice        BOOLEAN DEFAULT FALSE,   -- true if user spoke (not typed)
  feedback        TEXT,                    -- AI feedback on user's answer
  answer_score    INTEGER CHECK (answer_score BETWEEN 1 AND 10),
  question_number INTEGER,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ROW LEVEL SECURITY (RLS) ─────────────────────────────────────────────────
-- Users can ONLY see their own data. This is enforced at DB level.

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Sessions: user can only read/write their own
CREATE POLICY "Users read own sessions"
  ON sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own sessions"
  ON sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own sessions"
  ON sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Messages: user can only read messages from their own sessions
CREATE POLICY "Users read own messages"
  ON messages FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users insert own messages"
  ON messages FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

-- ─── INDEXES (for faster queries) ────────────────────────────────────────────
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_created_at ON sessions(created_at);
CREATE INDEX idx_messages_session_id ON messages(session_id);

-- ─── DONE ─────────────────────────────────────────────────────────────────────
-- You can view all data in: Supabase Dashboard → Table Editor
-- Filter by user, role, score, date — everything is there.
