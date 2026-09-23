import { Module } from '@nestjs/common';
import { AgentRuntimeService } from './agent-runtime.service.js';
import { FakeProvider } from './providers/fake.provider.js';
import { LLM_PROVIDER } from './providers/llm-provider.interface.js';

@Module({
  providers: [
    FakeProvider,
    {
      provide: LLM_PROVIDER,
      useExisting: FakeProvider,
    },
    AgentRuntimeService,
  ],
  exports: [AgentRuntimeService],
})
export class AgentModule {}
