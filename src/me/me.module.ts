import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from '../auth/auth.module'
import { MeController } from './me.controller'

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [MeController],
})
export class MeModule {}
