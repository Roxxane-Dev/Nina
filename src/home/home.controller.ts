import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { HomeIntelligenceService, HomeIntelligencePayload } from './home-intelligence.service';

@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeIntelligenceService) {}

  /**
   * CORE API: Aggregated intelligence for Nina's home screen.
   */
  @Get('intelligence')
  async getIntelligence(@Request() req: any): Promise<HomeIntelligencePayload> {
    const userId = req.user?.id || 'mock-user-id';
    return this.homeService.getIntelligence(userId);
  }
}
