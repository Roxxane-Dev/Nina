import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ContextPacket } from './context-packet';

@Injectable()
export class ContextPacketValidator {
  private readonly logger = new Logger(ContextPacketValidator.name);

  validate(packet: ContextPacket): void {
    if (!packet.userId) {
      throw new BadRequestException('ContextPacket missing userId');
    }

    if (!packet.memories) {
      this.logger.warn(`ContextPacket for ${packet.userId} has null memories. Initializing empty list.`);
      packet.memories = [];
    }

    // Token safety check (mock)
    const estimatedTokens = JSON.stringify(packet).length / 4;
    if (estimatedTokens > 100000) {
      throw new BadRequestException('ContextPacket exceeds token safety limits');
    }

    this.logger.debug(`[VALIDATION] ContextPacket for ${packet.userId} is valid.`);
  }
}
