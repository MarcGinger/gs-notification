import { Global, Module } from '@nestjs/common';
import { SlackApiService } from './slack-api.service';

@Global()
@Module({
  providers: [SlackApiService],
  exports: [SlackApiService],
})
export class SlackModule {}
