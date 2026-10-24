import type { ConfigService } from '@nestjs/config'
import { DEFAULT_USD_PEN_RATE } from '../../packages/finance-engine/src'

/** Reference USD→PEN rate used to plan goals written in dollars. `USD_PEN_RATE` overrides the default. */
export function usdPenRate(config: ConfigService): number {
  const raw = Number(config.get<string>('USD_PEN_RATE'))
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_USD_PEN_RATE
}
