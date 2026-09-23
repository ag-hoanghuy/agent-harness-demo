import {
  asChannelId,
  asCorrelationId,
  asRunId,
  asToolCallId,
} from '../contracts/ids.js';
import type { ToolExecutorContext } from '../harness/tool-broker/tool-executor.interface.js';
import { LOCAL_MCP_TOOL_NAMES } from './local/local-tool-definitions.js';
import type { McpCallToolResult, McpClientPort } from './mcp-client.types.js';
import {
  McpInvalidResponseError,
  McpToolExecutionError,
  McpTransportError,
} from './mcp.errors.js';
import { McpToolExecutor } from './mcp-tool-executor.js';

const context: ToolExecutorContext = {
  toolCallId: asToolCallId('tool-call-mcp-unit'),
  runId: asRunId('run-mcp-unit'),
  channelId: asChannelId('channel-vietnam-discovery'),
  correlationId: asCorrelationId('mcp-unit-correlation'),
};

const createClient = (callTool: McpClientPort['callTool']): McpClientPort => ({
  callTool,
});

describe('McpToolExecutor', () => {
  it('normalize structured MCP success thành plain application object', async () => {
    const client = createClient(
      vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'protocol fallback' }],
        structuredContent: { assets: [{ id: 'asset-001' }] },
      } satisfies McpCallToolResult),
    );
    const executor = new McpToolExecutor(
      client,
      LOCAL_MCP_TOOL_NAMES.SEARCH_ASSETS,
    );

    await expect(
      executor.execute({ query: 'market' }, context),
    ).resolves.toEqual({ assets: [{ id: 'asset-001' }] });
  });

  it('map MCP tool error thành typed non-retryable error', async () => {
    const client = createClient(
      vi.fn().mockResolvedValue({
        isError: true,
        content: [
          {
            type: 'text',
            text: 'ASSET_NOT_FOUND: Không tìm thấy mock asset',
          },
        ],
      } satisfies McpCallToolResult),
    );
    const executor = new McpToolExecutor(
      client,
      LOCAL_MCP_TOOL_NAMES.GET_ASSET_METADATA,
    );

    const execution = executor.execute({ asset_id: 'missing' }, context);
    await expect(execution).rejects.toBeInstanceOf(McpToolExecutionError);
    await expect(execution).rejects.toMatchObject({
      code: 'MCP_TOOL_ERROR',
      retryable: false,
    });
  });

  it('giữ transport failure là retryable MCP error', async () => {
    const client = createClient(
      vi
        .fn()
        .mockRejectedValue(new McpTransportError('Transport test failure')),
    );
    const executor = new McpToolExecutor(
      client,
      LOCAL_MCP_TOOL_NAMES.SEARCH_ASSETS,
    );

    await expect(
      executor.execute({ query: 'market' }, context),
    ).rejects.toMatchObject({
      code: 'MCP_TRANSPORT_ERROR',
      retryable: true,
    });
  });

  it('reject MCP response không parse được', async () => {
    const client = createClient(
      vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'not-json' }],
      } satisfies McpCallToolResult),
    );
    const executor = new McpToolExecutor(
      client,
      LOCAL_MCP_TOOL_NAMES.SEARCH_ASSETS,
    );

    await expect(
      executor.execute({ query: 'market' }, context),
    ).rejects.toBeInstanceOf(McpInvalidResponseError);
  });

  it('forward AbortSignal và dừng chờ bằng typed transport error', async () => {
    let receivedSignal: AbortSignal | undefined;
    const client = createClient(
      vi.fn(
        async (
          _toolName: string,
          _input: unknown,
          signal?: AbortSignal,
        ): Promise<McpCallToolResult> => {
          receivedSignal = signal;
          return new Promise((_resolve, reject) => {
            signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          });
        },
      ),
    );
    const executor = new McpToolExecutor(
      client,
      LOCAL_MCP_TOOL_NAMES.SEARCH_ASSETS,
    );
    const controller = new AbortController();

    const execution = executor.execute(
      { query: 'market' },
      context,
      controller.signal,
    );
    controller.abort();

    await expect(execution).rejects.toBeInstanceOf(McpTransportError);
    expect(receivedSignal).toBe(controller.signal);
    expect(receivedSignal?.aborted).toBe(true);
  });
});
