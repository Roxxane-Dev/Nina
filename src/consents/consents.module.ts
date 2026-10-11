import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from '../auth/auth.module'
import { ConsentsController } from './consents.controller'
import { ConsentsService } from './consents.service'

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [ConsentsController],
  providers: [ConsentsService],
  exports: [ConsentsService],
})
export class ConsentsModule {}
