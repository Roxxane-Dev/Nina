import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Request,
  UseFilters,
  UseGuards,
} from '@nestjs/common'
import { randomUUID } from 'crypto'
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard'
import type { SupabaseUser } from '../auth/auth.service'
import { ChatService, type ChatReply } from './chat.service'
import { ChatExceptionFilter, type ChatRequest } from './chat-exception.filter'

type ChatBody = {
  message: string
  /** Signed pending registration returned by the previous reply. */
  pendingToken?: string
}

const MAX_MESSAGE_LENGTH = 1000

/**
 * Minimal HTTP surface for Nina chat.
 * userId is always extracted from the verified JWT — never trusted from the body.
 * Errors leave through ChatExceptionFilter with a code and requestId.
 */
@UseGuards(SupabaseAuthGuard)
@UseFilters(ChatExceptionFilter)
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post()
  async postMessage(
    @Request() req: ChatRequest & { user: SupabaseUser },
    @Body() body: ChatBody,
  ): Promise<ChatReply> {
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    if (!message) {
      throw new BadRequestException('message is required')
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(`message must be at most ${MAX_MESSAGE_LENGTH} characters`)
    }
    const pendingToken = typeof body.pendingToken === 'string' ? body.pendingToken : undefined
    req.chatRequestId = randomUUID()
    return this.chat.handleMessage(req.user.id, message, pendingToken, req.chatRequestId)
  }
}
