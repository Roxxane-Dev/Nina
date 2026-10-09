-- pgvector + messages store for Nina. Run in Supabase SQL editor or CLI.
-- Embedding dimension must match your embedding model (1536 = OpenAI text-embedding-3-small).

create extension if not exists vector;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists messages_user_id_created_at_idx
  on public.messages (user_id, created_at desc);

-- Optional at scale: ivfflat / hnsw on `embedding` once you have enough rows.

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
