import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthModule } from '../auth/auth.module'
import { SpacesController } from './spaces.controller'
import { SpacesService } from './spaces.service'

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [SpacesController],
  providers: [SpacesService],
  exports: [SpacesService],
})
export class SpacesModule {}
