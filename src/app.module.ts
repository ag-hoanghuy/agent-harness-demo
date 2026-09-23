import { Module } from '@nestjs/common';
import { AgentModule } from './agent/agent.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { RunOrchestrationModule } from './harness/orchestrator/run-orchestration.module.js';
import { HarnessRuntimeModule } from './harness/runtime/harness-runtime.module.js';
import { ToolBrokerModule } from './harness/tool-broker/tool-broker.module.js';
import { McpModule } from './mcp/mcp.module.js';

@Module({
  imports: [
    AgentModule,
    DatabaseModule,
    HarnessRuntimeModule,
    RunOrchestrationModule,
    ToolBrokerModule,
    McpModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
