-- ─────────────────────────────────────────────────────────────────────────────
-- 2. AI MOCK INTERVIEW PLATFORM — Schema Update
-- Run this in your Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add type, difficulty, and total_questions columns to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'qa';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS difficulty TEXT NOT NULL DEFAULT 'medium';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS total_questions INTEGER NOT NULL DEFAULT 5;

-- Update role check constraint to include Aptitude
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_role_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_role_check CHECK (role IN ('Frontend', 'Backend', 'DSA', 'System Design', 'Full Stack', 'Aptitude'));

-- 2. Create resumes table to store rated resumes
CREATE TABLE IF NOT EXISTS resumes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name     TEXT NOT NULL,
  score         INTEGER CHECK (score BETWEEN 0 AND 100),
  strengths     TEXT[],
  weaknesses    TEXT[],
  summary       TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for resumes table
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid errors)
DROP POLICY IF EXISTS "Users read own resumes" ON resumes;
DROP POLICY IF EXISTS "Users insert own resumes" ON resumes;

-- Create policies for resumes
CREATE POLICY "Users read own resumes" ON resumes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own resumes" ON resumes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
