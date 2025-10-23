import { Module } from '@nestjs/common';
import { ClockProvider } from './nest-clock.provider';

@Module({
  providers: [ClockProvider],
  exports: [ClockProvider],
})
export class TimeModule {}
