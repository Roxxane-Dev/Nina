import { Module, Global } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { FinancialEventBusService } from '../events/financial-event-bus.service';
import { IntelligenceGateway } from './intelligence.gateway';
import { FinancialStateMachineService } from '../intelligence/state-machine/financial-state-machine.service';
import { NotificationLifecycleService } from '../notifications/notification-lifecycle.service';

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
    }),
  ],
  providers: [
    FinancialEventBusService,
    IntelligenceGateway,
    FinancialStateMachineService,
    NotificationLifecycleService,
  ],
  exports: [
    FinancialEventBusService,
    FinancialStateMachineService,
    NotificationLifecycleService,
  ],
})
export class RealtimeModule {}
