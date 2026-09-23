import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import {
  McpConnectionError,
  McpToolExecutionError,
  McpTransportError,
} from './mcp.errors.js';
import type {
  McpCallToolResult,
  McpClientPort,
  McpToolDescriptor,
} from './mcp-client.types.js';
import {
  MCP_LOCAL_SERVER_LAUNCH,
  type McpLocalServerLaunch,
} from './mcp-launch.config.js';

interface ActiveConnection {
  readonly client: Client;
  readonly transport: StdioClientTransport;
}

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError';

@Injectable()
export class McpClientService implements McpClientPort, OnModuleDestroy {
  private connection?: ActiveConnection;
  private connecting?: Promise<ActiveConnection>;
  private destroyed = false;

  constructor(
    @Inject(MCP_LOCAL_SERVER_LAUNCH)
    private readonly launch: McpLocalServerLaunch,
  ) {}

  async connect(): Promise<void> {
    await this.getConnection();
  }

  async listTools(): Promise<readonly McpToolDescriptor[]> {
    const connection = await this.getConnection();
    try {
      const result = await connection.client.listTools();
      return Object.freeze(
        result.tools.map(({ name, description }) =>
          Object.freeze({ name, description }),
        ),
      );
    } catch (error) {
      throw await this.mapRequestError(error);
    }
  }

  async callTool(
    toolName: string,
    input: unknown,
    signal?: AbortSignal,
  ): Promise<McpCallToolResult> {
    const connection = await this.getConnection();
    try {
      const result = await connection.client.callTool(
        {
          name: toolName,
          arguments: input as Record<string, unknown>,
        },
        undefined,
        { signal },
      );
      if ('toolResult' in result) {
        return { content: [] };
      }
      return result;
    } catch (error) {
      const mapped = await this.mapRequestError(error, toolName);
      throw mapped;
    }
  }

  async close(): Promise<void> {
    this.destroyed = true;
    const connection = this.connection;
    const connecting = this.connecting;
    this.connection = undefined;
    this.connecting = undefined;
    const pendingConnection =
      connecting === undefined
        ? undefined
        : await connecting.catch(() => undefined);
    const connections = new Set(
      [connection, pendingConnection].filter(
        (candidate): candidate is ActiveConnection => candidate !== undefined,
      ),
    );

    for (const activeConnection of connections) {
      await this.closeConnection(activeConnection);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  private async getConnection(): Promise<ActiveConnection> {
    if (this.destroyed) {
      throw new McpConnectionError();
    }
    if (this.connection !== undefined) {
      return this.connection;
    }
    if (this.connecting !== undefined) {
      return this.connecting;
    }

    this.connecting = this.openConnection();
    try {
      const connection = await this.connecting;
      if (this.destroyed) {
        throw new McpConnectionError();
      }
      this.connection = connection;
      return this.connection;
    } finally {
      this.connecting = undefined;
    }
  }

  private async openConnection(): Promise<ActiveConnection> {
    const client = new Client({
      name: 'agent-harness-mcp-client',
      version: '1.0.0',
    });
    const transport = new StdioClientTransport({
      command: this.launch.command,
      args: [...this.launch.args],
      cwd: this.launch.cwd,
      stderr: 'pipe',
    });

    try {
      await client.connect(transport);
      return { client, transport };
    } catch (error) {
      await transport.close().catch(() => undefined);
      throw new McpConnectionError({ cause: error });
    }
  }

  private async mapRequestError(
    error: unknown,
    toolName?: string,
  ): Promise<Error> {
    if (
      isAbortError(error) ||
      (error instanceof McpError &&
        [ErrorCode.ConnectionClosed, ErrorCode.RequestTimeout].includes(
          error.code,
        ))
    ) {
      await this.resetConnection();
      return new McpTransportError(
        isAbortError(error)
          ? 'MCP request đã bị hủy'
          : 'Kết nối MCP bị gián đoạn',
        { cause: error },
      );
    }
    if (error instanceof McpError && toolName !== undefined) {
      return new McpToolExecutionError(toolName, undefined, false, {
        cause: error,
      });
    }

    await this.resetConnection();
    return new McpTransportError('MCP transport thất bại', { cause: error });
  }

  private async resetConnection(): Promise<void> {
    const connection = this.connection;
    this.connection = undefined;
    if (connection !== undefined) {
      await this.closeConnection(connection);
    }
  }

  private async closeConnection(connection: ActiveConnection): Promise<void> {
    try {
      await connection.client.close();
    } catch {
      await connection.transport.close().catch(() => undefined);
    }
  }
}
