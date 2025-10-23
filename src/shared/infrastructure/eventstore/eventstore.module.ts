import { Module, Global } from '@nestjs/common';
import { EventStoreService } from './eventstore.service';
import { LoggingModule } from '../../logging/logging.module';
import { EVENTSTORE_DB_CLIENT } from '../../constants/injection-tokens';

@Global()
@Module({
  imports: [LoggingModule],
  providers: [
    EventStoreService,
    // Export the underlying client for explicit injection in infrastructure
    {
      provide: EVENTSTORE_DB_CLIENT,
      inject: [EventStoreService],
      useFactory: (eventStoreService: EventStoreService) => {
        return eventStoreService.getClient();
      },
    },
  ],
  exports: [
    EventStoreService,
    // Export the underlying client for explicit injection in infrastructure
    {
      provide: EVENTSTORE_DB_CLIENT,
      inject: [EventStoreService],
      useFactory: (eventStoreService: EventStoreService) => {
        return eventStoreService.getClient();
      },
    },
  ],
})
export class EventStoreModule {}
