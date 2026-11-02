import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from '../auth/auth.module'
import { DataExportService } from './data-export.service'
import { MeController } from './me.controller'

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [MeController],
  providers: [DataExportService],
})
export class MeModule {}
