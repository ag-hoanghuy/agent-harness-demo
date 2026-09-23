import type {
  ChannelId,
  CorrelationId,
  RunId,
  ToolCallId,
} from '../../contracts/ids.js';
import type { ToolDefinition } from './tool.contract.js';

export interface ToolExecutionRequest {
  readonly toolName: string;
  readonly input: unknown;
  readonly actor: string;
  readonly correlationId: CorrelationId;
}

export interface ToolExecutorContext {
  readonly toolCallId: ToolCallId;
  readonly runId: RunId;
  readonly channelId: ChannelId;
  readonly correlationId: CorrelationId;
}

export interface ToolExecutor {
  execute(
    input: unknown,
    context: ToolExecutorContext,
    signal?: AbortSignal,
  ): Promise<unknown>;
}

export interface RegisteredTool {
  readonly definition: ToolDefinition;
  readonly executor: ToolExecutor;
}
