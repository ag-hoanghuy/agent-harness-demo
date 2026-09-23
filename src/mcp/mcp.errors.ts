import { ToolExecutionError } from '../harness/tool-broker/tool-broker.errors.js';

export class McpConnectionError extends ToolExecutionError {
  constructor(options?: ErrorOptions) {
    super(
      'MCP_CONNECTION_ERROR',
      'Không thể kết nối Local MCP server',
      true,
      options,
    );
    this.name = 'McpConnectionError';
  }
}

export class McpTransportError extends ToolExecutionError {
  constructor(message = 'Kết nối MCP bị gián đoạn', options?: ErrorOptions) {
    super('MCP_TRANSPORT_ERROR', message, true, options);
    this.name = 'McpTransportError';
  }
}

export class McpToolExecutionError extends ToolExecutionError {
  constructor(
    toolName: string,
    message = `MCP tool ${toolName} thất bại`,
    retryable = false,
    options?: ErrorOptions,
  ) {
    super('MCP_TOOL_ERROR', message, retryable, options);
    this.name = 'McpToolExecutionError';
  }
}

export class McpInvalidResponseError extends ToolExecutionError {
  constructor(toolName: string, reason: string, options?: ErrorOptions) {
    super(
      'MCP_INVALID_RESPONSE',
      `Response của MCP tool ${toolName} không hợp lệ: ${reason}`,
      false,
      options,
    );
    this.name = 'McpInvalidResponseError';
  }
}
