import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '../../config/config.module';
import { OpaClient } from './opa.client';
import { OpaGuard } from './opa.guard';
import { AuditModule } from '../audit/audit.module';
import { LoggingModule } from '../../logging';

@Module({
  imports: [HttpModule, ConfigModule, LoggingModule, AuditModule.forRoot()],
  providers: [OpaClient, OpaGuard],
  exports: [OpaClient, OpaGuard],
})
export class OpaModule {}
