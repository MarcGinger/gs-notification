import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ConfigManager } from './config.manager';

/**
 * Global configuration module that provides ConfigManager
 * and sets up NestJS ConfigModule for environment loading
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
  ],
  providers: [
    {
      provide: ConfigManager,
      useValue: ConfigManager.getInstance(),
    },
  ],
  exports: [ConfigManager],
})
export class ConfigModule {}
