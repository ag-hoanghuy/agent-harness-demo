import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ToolRegistryService } from '../harness/tool-broker/tool-registry.service.js';
import {
  LOCAL_MCP_TOOL_DEFINITIONS,
  LOCAL_MCP_TOOL_NAME_LIST,
} from './local/local-tool-definitions.js';
import { McpClientService } from './mcp-client.service.js';
import { McpToolExecutor } from './mcp-tool-executor.js';

@Injectable()
export class McpToolRegistrationService implements OnModuleInit {
  constructor(
    private readonly registry: ToolRegistryService,
    private readonly client: McpClientService,
  ) {}

  onModuleInit(): void {
    for (const toolName of LOCAL_MCP_TOOL_NAME_LIST) {
      this.registry.register({
        definition: LOCAL_MCP_TOOL_DEFINITIONS[toolName],
        executor: new McpToolExecutor(this.client, toolName),
      });
    }
  }
}
