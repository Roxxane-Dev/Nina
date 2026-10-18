-- 003_gemini_embeddings.sql
-- Migrates the messages table from OpenAI (1536-d) to Gemini gemini-embedding-001 (768-d).
-- Run this ONLY if you haven't stored real messages yet, or are OK truncating.
-- If you have real data you want to keep, drop and recreate the embedding column.

-- Step 1: Drop the old 1536-d embedding column and old index
alter table public.messages drop column if exists embedding;

-- Step 2: Add a new 768-d embedding column (Gemini gemini-embedding-001)
alter table public.messages
  add column embedding vector(768);

-- Step 3: Recreate the semantic search function with the 768-d signature
create or replace function public.match_messages(
  p_user_id uuid,
  query_embedding vector(768),
  match_count int default 5
)
returns table (
  id uuid,
  role text,
  content text,
  similarity double precision
)
language sql
stable
as $$
  select
    m.id,
    m.role,
    m.content,
    (1 - (m.embedding <=> query_embedding))::double precision as similarity
  from public.messages m
  where m.user_id = p_user_id
    and m.embedding is not null
  order by m.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

-- Optional: add a vector index once you have enough rows (>1000)
-- create index messages_embedding_idx 
--   on public.messages using hnsw (embedding vector_cosine_ops);
