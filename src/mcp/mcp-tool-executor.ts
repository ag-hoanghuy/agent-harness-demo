import type {
  ToolExecutor,
  ToolExecutorContext,
} from '../harness/tool-broker/tool-executor.interface.js';
import {
  McpInvalidResponseError,
  McpToolExecutionError,
  McpTransportError,
} from './mcp.errors.js';
import type {
  McpCallToolResult,
  McpClientPort,
  McpTextContent,
} from './mcp-client.types.js';
import type { LocalMcpToolName } from './local/local-tool-definitions.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isTextContent = (value: unknown): value is McpTextContent =>
  isRecord(value) && value.type === 'text' && typeof value.text === 'string';

const readToolError = (result: McpCallToolResult): string | undefined => {
  const text = result.content?.find(isTextContent)?.text.trim();
  return text === undefined || text.length === 0
    ? undefined
    : text.slice(0, 300);
};

export class McpToolExecutor implements ToolExecutor {
  constructor(
    private readonly client: McpClientPort,
    readonly toolName: LocalMcpToolName,
  ) {}

  async execute(
    input: unknown,
    _context: ToolExecutorContext,
    signal?: AbortSignal,
  ): Promise<unknown> {
    let result: McpCallToolResult;
    try {
      result = await this.client.callTool(this.toolName, input, signal);
    } catch (error) {
      if (
        signal?.aborted === true ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        throw new McpTransportError('MCP request đã bị hủy', { cause: error });
      }
      throw error;
    }

    if (result.isError === true) {
      throw new McpToolExecutionError(
        this.toolName,
        readToolError(result) ?? `MCP tool ${this.toolName} thất bại`,
      );
    }
    if (isRecord(result.structuredContent)) {
      return result.structuredContent;
    }

    const textBlocks = result.content?.filter(isTextContent) ?? [];
    if (textBlocks.length !== 1) {
      throw new McpInvalidResponseError(
        this.toolName,
        'thiếu structuredContent và không có đúng một JSON text block',
      );
    }

    try {
      const parsed: unknown = JSON.parse(textBlocks[0].text);
      if (!isRecord(parsed)) {
        throw new Error('JSON root không phải object');
      }
      return parsed;
    } catch (error) {
      throw new McpInvalidResponseError(
        this.toolName,
        'JSON text block không parse được thành object',
        { cause: error },
      );
    }
  }
}
