export interface McpTextContent {
  readonly type: 'text';
  readonly text: string;
}

export interface McpCallToolResult {
  readonly content?: readonly unknown[];
  readonly structuredContent?: Readonly<Record<string, unknown>>;
  readonly isError?: boolean;
}

export interface McpClientPort {
  callTool(
    toolName: string,
    input: unknown,
    signal?: AbortSignal,
  ): Promise<McpCallToolResult>;
}

export interface McpToolDescriptor {
  readonly name: string;
  readonly description?: string;
}
