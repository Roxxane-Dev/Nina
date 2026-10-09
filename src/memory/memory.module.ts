import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { MemoryService } from './memory.service'

@Module({
  imports: [ConfigModule],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
