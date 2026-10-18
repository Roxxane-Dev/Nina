-- 006_openai_embeddings.sql
-- Reverts the messages table from Gemini (768-d) back to OpenAI text-embedding-3-small (1536-d).
-- Safe to run if you have no production messages, or are OK clearing embeddings.

-- Step 1: Drop the 768-d Gemini column
alter table public.messages drop column if exists embedding;

-- Step 2: Add the 1536-d OpenAI column
alter table public.messages
  add column embedding vector(1536);

-- Step 3: Recreate the semantic search function for 1536-d
create or replace function public.match_messages(
  p_user_id uuid,
  query_embedding vector(1536),
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

-- Optional: add HNSW index once row count > 1000
-- create index messages_embedding_idx
--   on public.messages using hnsw (embedding vector_cosine_ops);
