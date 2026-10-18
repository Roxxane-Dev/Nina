import { Injectable } from '@nestjs/common';

@Injectable()
export class FeatureFlagService {
  private readonly flags = {
    'advanced_household_mode': false,
    'realtime_streaming': true,
  };

  isEnabled(flag: keyof typeof this.flags, userId?: string): boolean {
    // Logic for gradual rollout or premium gating
    return this.flags[flag] || false;
  }
}
