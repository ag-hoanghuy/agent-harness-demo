import { ToolRegistryService } from '../harness/tool-broker/tool-registry.service.js';
import { ToolSchemaValidatorService } from '../harness/tool-broker/tool-schema-validator.service.js';
import {
  LOCAL_MCP_TOOL_NAME_LIST,
  type LocalMcpToolName,
} from './local/local-tool-definitions.js';
import type { McpClientPort } from './mcp-client.types.js';
import { McpClientService } from './mcp-client.service.js';
import { McpToolExecutor } from './mcp-tool-executor.js';
import { McpToolRegistrationService } from './mcp-tool-registration.service.js';

describe('McpToolRegistrationService', () => {
  it('register đúng ba MCP-backed executor vào ToolRegistry', () => {
    const registry = new ToolRegistryService(new ToolSchemaValidatorService());
    const client: McpClientPort = {
      callTool: vi.fn().mockResolvedValue({ structuredContent: {} }),
    };
    const registration = new McpToolRegistrationService(
      registry,
      client as McpClientService,
    );

    registration.onModuleInit();

    for (const toolName of LOCAL_MCP_TOOL_NAME_LIST) {
      const registered = registry.resolve(toolName);
      expect(registered.executor).toBeInstanceOf(McpToolExecutor);
      expect((registered.executor as McpToolExecutor).toolName).toBe(
        toolName as LocalMcpToolName,
      );
      expect(registered.definition.idempotent).toBe(true);
      expect(registered.definition.side_effect).toBe(false);
    }
  });
});
