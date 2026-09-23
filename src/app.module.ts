import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { HarnessRuntimeModule } from './harness/runtime/harness-runtime.module.js';

@Module({
  imports: [DatabaseModule, HarnessRuntimeModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
