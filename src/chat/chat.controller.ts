import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common'
import type { Request as ExpressRequest } from 'express'
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard'
import type { SupabaseUser } from '../auth/auth.service'
import { ChatService, type ChatReply } from './chat.service'

type ChatBody = {
  message: string
}

const MAX_MESSAGE_LENGTH = 1000

/**
 * Minimal HTTP surface for Nina chat.
 * userId is always extracted from the verified JWT — never trusted from the body.
 */
@UseGuards(SupabaseAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post()
  async postMessage(
    @Request() req: ExpressRequest & { user: SupabaseUser },
    @Body() body: ChatBody,
  ): Promise<ChatReply> {
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    if (!message) {
      throw new BadRequestException('message is required')
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(`message must be at most ${MAX_MESSAGE_LENGTH} characters`)
    }
    return this.chat.handleMessage(req.user.id, message)
  }
}
