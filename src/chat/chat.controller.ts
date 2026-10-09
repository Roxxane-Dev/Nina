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
import { ChatService } from './chat.service'
import type { ProcessMessageOptions } from '../ai/ai.service'

type ChatBody = {
  message: string
  provider?: string
}

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
  ) {
    if (!body?.message?.trim()) {
      throw new BadRequestException('message is required')
    }

    const userId = req.user.id

    const aiOptions: ProcessMessageOptions | undefined = body.provider
      ? { provider: body.provider }
      : undefined

    const reply = await this.chat.handleMessage(userId, body.message, aiOptions)
    return { reply }
  }
}
