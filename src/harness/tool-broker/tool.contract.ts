import {
  TOOL_CALL_SCHEMA_VERSION,
  TOOL_DEFINITION_SCHEMA_VERSION,
} from '../../contracts/schema-version.js';
import {
  ChannelId,
  CorrelationId,
  RunId,
  ToolCallId,
} from '../../contracts/ids.js';
import { ToolCallStatus } from './tool-call-status.enum.js';

export interface ToolDefinition {
  name: string;
  schema_version: typeof TOOL_DEFINITION_SCHEMA_VERSION;
  required_permissions: readonly string[];
  input_schema: JsonSchema;
  output_schema: JsonSchema;
  timeout_ms: number;
  max_retries: number;
  idempotent: boolean;
  side_effect: boolean;
}

export type JsonSchema = Readonly<Record<string, unknown>>;

export interface ToolCallError {
  code: string;
  message: string;
  retryable?: boolean;
}

export interface ToolCall {
  id: ToolCallId;
  run_id: RunId;
  channel_id: ChannelId;
  tool_name: string;
  status: ToolCallStatus;
  input: unknown;
  output?: unknown;
  error?: ToolCallError;
  correlation_id: CorrelationId;
  created_at: string;
  completed_at?: string;
  schema_version: typeof TOOL_CALL_SCHEMA_VERSION;
}
