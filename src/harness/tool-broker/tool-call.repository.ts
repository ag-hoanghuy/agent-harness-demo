import { RunId, ToolCallId } from '../../contracts/ids.js';
import { ToolCall, ToolCallError } from './tool.contract.js';
import { ToolCallStatus } from './tool-call-status.enum.js';

export const TOOL_CALL_REPOSITORY = Symbol('TOOL_CALL_REPOSITORY');

export interface ToolCallStatusUpdate {
  status: ToolCallStatus;
  output?: unknown;
  error?: ToolCallError;
  completed_at?: string;
}

export interface ToolCallRepository {
  create(toolCall: ToolCall): Promise<ToolCall>;
  updateStatus(id: ToolCallId, update: ToolCallStatusUpdate): Promise<ToolCall>;
  findById(id: ToolCallId): Promise<ToolCall | null>;
  findByRunId(runId: RunId): Promise<readonly ToolCall[]>;
}
