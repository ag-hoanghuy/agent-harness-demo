import { Module } from '@nestjs/common';
import { ToolBrokerModule } from '../harness/tool-broker/tool-broker.module.js';
import { McpClientService } from './mcp-client.service.js';
import {
  createLocalMcpServerLaunch,
  MCP_LOCAL_SERVER_LAUNCH,
} from './mcp-launch.config.js';
import { McpToolRegistrationService } from './mcp-tool-registration.service.js';

@Module({
  imports: [ToolBrokerModule],
  providers: [
    {
      provide: MCP_LOCAL_SERVER_LAUNCH,
      useFactory: createLocalMcpServerLaunch,
    },
    McpClientService,
    McpToolRegistrationService,
  ],
  exports: [McpClientService],
})
export class McpModule {}
