-- Migration: Intelligence Snapshots Table (v2)
-- Description: Stores precomputed intelligence states with versioning and freshness indicators.

CREATE TABLE IF NOT EXISTS public.intelligence_snapshots (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    snapshot_type VARCHAR(50) NOT NULL, -- e.g., 'home_intelligence', 'financial_health'
    snapshot_version INTEGER DEFAULT 1,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    freshness_score FLOAT DEFAULT 1.0,
    metadata JSONB DEFAULT '{}'::jsonb,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optimized Index for fast mobile retrieval
CREATE INDEX idx_snapshots_user_type_generated ON public.intelligence_snapshots(user_id, snapshot_type, generated_at DESC);

-- Setup RLS
ALTER TABLE public.intelligence_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own snapshots"
    ON public.intelligence_snapshots FOR SELECT
    USING (auth.uid() = user_id);
