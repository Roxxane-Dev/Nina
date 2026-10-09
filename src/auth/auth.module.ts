import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AuthService } from './auth.service'
import { SupabaseAuthGuard } from './supabase-auth.guard'

@Module({
  imports: [ConfigModule],
  providers: [AuthService, SupabaseAuthGuard],
  exports: [AuthService, SupabaseAuthGuard],
})
export class AuthModule {}
