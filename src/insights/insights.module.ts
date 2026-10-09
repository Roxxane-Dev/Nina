import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { InsightsService } from './insights.service'

@Module({
  imports: [ConfigModule],
  providers: [InsightsService],
  exports: [InsightsService],
})
export class InsightsModule {}
