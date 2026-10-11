import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { CategoryRulesService } from './category-rules.service'

@Module({
  imports: [ConfigModule],
  providers: [CategoryRulesService],
  exports: [CategoryRulesService],
})
export class CategoryRulesModule {}
