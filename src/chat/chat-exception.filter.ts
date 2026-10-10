import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { FinanceDataUnavailableError } from '../finance-engine/errors'

export type ChatRequest = Request & { chatRequestId?: string }

export const DATA_UNAVAILABLE_REPLY = 'No pude consultar tus movimientos ahora. Inténtalo en unos minutos.'
export const INTERNAL_REPLY = 'Tuve un problema procesando tu mensaje. Inténtalo de nuevo.'

/**
 * Last line of defence for /chat: no error leaves without a requestId and a
 * specific code. Infrastructure → 503 DATA_UNAVAILABLE; bugs → 500 INTERNAL.
 * Validation errors (4xx) keep their status. The turn itself is already logged
 * by ChatService with the stack; this only shapes the response.
 */
@Catch()
export class ChatExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ChatExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const res = http.getResponse<Response>()
    const req = http.getRequest<ChatRequest>()
    const requestId = req.chatRequestId

    if (exception instanceof FinanceDataUnavailableError) {
      res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: exception.code,
        message: DATA_UNAVAILABLE_REPLY,
        requestId,
      })
      return
    }

    if (exception instanceof HttpException && exception.getStatus() < 500) {
      res.status(exception.getStatus()).json(exception.getResponse())
      return
    }

    if (!requestId) {
      // Failed before ChatService could log it (e.g. in the guard): log here.
      this.logger.error(`chat request failed: ${exception instanceof Error ? exception.name : 'unknown'}`)
    }
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL',
      message: INTERNAL_REPLY,
      requestId,
    })
  }
}
