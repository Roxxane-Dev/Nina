import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const logger = new Logger('Bootstrap')

  logger.log('[BOOT] Starting Nina OS backend...')

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  })

  // Enable CORS for Flutter web + emulator
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })

  const port = process.env.PORT ?? 3000
  await app.listen(port, '0.0.0.0')

  logger.log(`[WS READY]   WebSocket gateway listening on ws://0.0.0.0:${port}/intelligence`)
  logger.log(`[JOBS READY] Scheduled jobs registered`)
  logger.log(`[NINA OS READY] Backend running on http://0.0.0.0:${port}`)
}

bootstrap()
