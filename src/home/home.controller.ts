import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import type { SupabaseUser } from '../auth/auth.service';
import { HomeIntelligenceService, HomeIntelligencePayload } from './home-intelligence.service';

@UseGuards(SupabaseAuthGuard)
@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeIntelligenceService) {}

  /**
   * CORE API: Aggregated intelligence for Nina's home screen.
   * userId always comes from the verified JWT.
   */
  @Get('intelligence')
  async getIntelligence(
    @Request() req: ExpressRequest & { user: SupabaseUser },
  ): Promise<HomeIntelligencePayload> {
    return this.homeService.getIntelligence(req.user.id);
  }
}
