import { Module } from '@nestjs/common'
import { AIModule } from '../ai/ai.module'
import { NinaRouterService } from './nina-router.service'

@Module({
  imports: [AIModule],
  providers: [NinaRouterService],
  exports: [NinaRouterService],
})
export class NinaRouterModule {}
