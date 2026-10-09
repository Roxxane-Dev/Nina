-- Migration: Financial Streaks Table
-- Description: Tracks behavioral streaks for financial discipline, savings, and recovery.

CREATE TABLE IF NOT EXISTS financial_streaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    streak_type TEXT NOT NULL, -- 'no_impulsive_spending', 'savings', 'budget_consistency', 'recovery'
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'broken', 'completed'
    current_length INTEGER NOT NULL DEFAULT 0,
    longest_length INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, streak_type)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_financial_streaks_user_id ON financial_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_streaks_type ON financial_streaks(streak_type);

-- RLS Policies
ALTER TABLE financial_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own streaks"
ON financial_streaks FOR SELECT
USING (auth.uid() = user_id);

-- Snapshot trigger (optional: could be updated via nightly job)
