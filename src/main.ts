import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { AppModule } from './app.module'
import { ConfigService } from '@nestjs/config'
import { AllowlistIoAdapter, httpCorsOptions, resolveAllowedOrigins } from './realtime/socket-cors'

async function bootstrap() {
  const logger = new Logger('Bootstrap')

  logger.log('[BOOT] Starting Nina OS backend...')

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  })

  // CORS: same CORS_ALLOWED_ORIGINS allowlist as the WebSocket. Empty = no browser origin in
  // production; in development loopback origins (localhost, any port) are allowed.
  // Native mobile clients send no Origin header and are unaffected.
  const config = app.get(ConfigService)
  const origins = resolveAllowedOrigins(config.get<string>('CORS_ALLOWED_ORIGINS'), config.get<string>('NODE_ENV') ?? process.env.NODE_ENV)
  if (origins.length === 0) logger.warn('CORS_ALLOWED_ORIGINS is empty and NODE_ENV=production: no browser origin can call the API')
  app.enableCors(httpCorsOptions(origins))

  app.useWebSocketAdapter(new AllowlistIoAdapter(app))

  const port = process.env.PORT ?? 3000
  await app.listen(port, '0.0.0.0')

  logger.log(`[WS READY]   WebSocket gateway listening on ws://0.0.0.0:${port}/intelligence`)
  logger.log(`[JOBS READY] Scheduled jobs registered`)
  logger.log(`[NINA OS READY] Backend running on http://0.0.0.0:${port}`)
}

bootstrap()
