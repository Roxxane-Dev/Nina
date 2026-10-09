import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import type { Memory } from '../ai/ai.types'
import { dedupeMemories, sortMemoriesByRelevance } from '../ai/memory-utils'
import { createAdminClient } from '../common/supabase.client'

/**
 * OpenAI text-embedding-3-small → 1536-dimensional vectors.
 * The `messages` table `embedding` column MUST be vector(1536).
 * Run migration 006_openai_embeddings.sql if you were previously on Gemini (768-d).
 *
 * Strict rule: OpenAI is ONLY used here for embeddings.
 *              Gemini is ONLY used in GeminiProvider for text generation.
 */
const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small'
const MATCH_COUNT = 5

@Injectable()
export class MemoryService implements OnModuleInit {
  private readonly logger = new Logger(MemoryService.name)

  private adminClient!: SupabaseClient
  private openai!: OpenAI

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    // ── Supabase admin client (service role — bypasses RLS) ──────────────────
    const url = this.config.get<string>('SUPABASE_URL')
    const key =
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY') ??
      this.config.get<string>('SUPABASE_ANON_KEY')

    if (url && key) {
      this.adminClient = createAdminClient(url, key)
      this.logger.log('MemoryService: Supabase admin client initialized')
    } else {
      this.logger.warn('Supabase not configured; MemoryService will be a no-op')
    }

    // ── OpenAI client (embeddings ONLY) ─────────────────────────────────────
    const openaiKey = this.config.get<string>('OPENAI_API_KEY')
    if (!openaiKey) {
      this.logger.warn(
        'OPENAI_API_KEY not set; semantic memory disabled. ' +
          'Set OPENAI_API_KEY to enable vector search.',
      )
    } else {
      this.openai = new OpenAI({ apiKey: openaiKey })
      this.logger.log(
        `MemoryService: using OpenAI embedding model "${OPENAI_EMBEDDING_MODEL}" (1536-d)`,
      )
    }
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  async retrieveRelevantMemories(userId: string, queryText: string): Promise<Memory[]> {
    if (!this.adminClient || !this.openai) return []

    try {
      const embedding = await this.embedText(queryText)
      const { data, error } = await this.adminClient.rpc('match_messages', {
        p_user_id: userId,
        query_embedding: embedding,
        match_count: MATCH_COUNT,
      })

      if (error) {
        this.logger.warn(`match_messages failed: ${error.message}`)
        return []
      }

      const rows = (data ?? []) as {
        id: string
        role: string
        content: string
        similarity: number
      }[]

      const memories: Memory[] = rows.map((r) => ({
        content: r.content,
        role: r.role as 'user' | 'assistant' | 'pattern',
        relevanceScore: r.similarity,
      }))

      return sortMemoriesByRelevance(dedupeMemories(memories))
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      this.logger.warn(`retrieveRelevantMemories failed: ${msg}`)
      return []
    }
  }

  async storeMessage(
    userId: string,
    role: 'user' | 'assistant' | 'pattern',
    content: string,
  ): Promise<void> {
    if (!this.adminClient || !this.openai) {
      this.logger.warn('Memory storage skipped: Supabase or OpenAI not configured')
      return
    }

    const trimmed = content.trim()
    if (!trimmed) return

    try {
      const embedding = await this.embedText(trimmed)
      const { error } = await this.adminClient.from('messages').insert({
        user_id: userId,
        role,
        content: trimmed,
        embedding,
      })

      if (error) {
        this.logger.error(`storeMessage insert failed: ${error.message}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      this.logger.error(`storeMessage failed: ${msg}`)
    }
  }

  async storeExchange(
    userId: string,
    userMessage: string,
    assistantMessage: string,
  ): Promise<void> {
    await this.storeMessage(userId, 'user', userMessage)
    await this.storeMessage(userId, 'assistant', assistantMessage)
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private async embedText(text: string): Promise<number[]> {
    console.log('USING EMBEDDING MODEL:', OPENAI_EMBEDDING_MODEL)

    const res = await this.openai.embeddings.create({
      model: OPENAI_EMBEDDING_MODEL,
      input: text,
    })

    const embedding = res.data[0].embedding
    console.log('EMBEDDING LENGTH:', embedding.length)

    if (embedding.length !== 1536) {
      throw new Error(
        `Unexpected embedding dimension: got ${embedding.length}, expected 1536. ` +
          `Check OPENAI_EMBEDDING_MODEL is "${OPENAI_EMBEDDING_MODEL}".`,
      )
    }

    return embedding
  }
}
