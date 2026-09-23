import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { RunPolicyService } from '../control-plane/run-policy.service.js';
import { HarnessRuntimeModule } from '../runtime/harness-runtime.module.js';
import { RuntimeIdFactory } from './runtime-id.factory.js';
import { HarnessRunOrchestrator } from './run-orchestrator.service.js';

@Module({
  imports: [DatabaseModule, HarnessRuntimeModule],
  providers: [RuntimeIdFactory, RunPolicyService, HarnessRunOrchestrator],
  exports: [HarnessRunOrchestrator],
})
export class RunOrchestrationModule {}
