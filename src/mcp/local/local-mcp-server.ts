import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { fileURLToPath } from 'node:url';
import {
  getAssetMetadataInputSchema,
  getAssetMetadataOutputSchema,
  getRecentAnalyticsInputSchema,
  getRecentAnalyticsOutputSchema,
  LOCAL_MCP_TOOL_NAMES,
  searchAssetsInputSchema,
  searchAssetsOutputSchema,
} from './local-tool-definitions.js';
import {
  getAssetMetadata,
  getRecentAnalytics,
  LocalMcpToolError,
  searchAssets,
} from './local-mcp-tools.js';

const successResult = (output: Readonly<Record<string, unknown>>) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(output) }],
  structuredContent: output,
});

const errorResult = (error: unknown) => {
  const message =
    error instanceof LocalMcpToolError
      ? `${error.code}: ${error.message}`
      : 'LOCAL_MCP_TOOL_ERROR: Local MCP tool thất bại';
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
  };
};

export const createLocalMcpServer = (): McpServer => {
  const server = new McpServer({
    name: 'agent-harness-local-mcp',
    version: '1.0.0',
  });

  server.registerTool(
    LOCAL_MCP_TOOL_NAMES.SEARCH_ASSETS,
    {
      description: 'Tìm mock media asset theo từ khóa.',
      inputSchema: searchAssetsInputSchema,
      outputSchema: searchAssetsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => successResult(searchAssets(input)),
  );

  server.registerTool(
    LOCAL_MCP_TOOL_NAMES.GET_ASSET_METADATA,
    {
      description: 'Đọc metadata của một mock media asset.',
      inputSchema: getAssetMetadataInputSchema,
      outputSchema: getAssetMetadataOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        return successResult(getAssetMetadata(input));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.registerTool(
    LOCAL_MCP_TOOL_NAMES.GET_RECENT_ANALYTICS,
    {
      description: 'Đọc analytics mock gần đây của demo channel.',
      inputSchema: getRecentAnalyticsInputSchema,
      outputSchema: getRecentAnalyticsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (input) => {
      try {
        return successResult(getRecentAnalytics(input));
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  return server;
};

export const startLocalMcpServer = async (): Promise<void> => {
  const server = createLocalMcpServer();
  await server.connect(new StdioServerTransport());
  console.error('Local MCP server đang chạy qua stdio');
};

const entrypointPath = process.argv[1];
if (
  entrypointPath !== undefined &&
  fileURLToPath(import.meta.url) === entrypointPath
) {
  void startLocalMcpServer().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Không thể khởi động Local MCP server: ${message}`);
    process.exitCode = 1;
  });
}
