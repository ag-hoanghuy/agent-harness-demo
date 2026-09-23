import {
  asChannelId,
  asCorrelationId,
  asRunId,
  asToolCallId,
} from '../../../contracts/ids.js';
import { TOOL_CALL_SCHEMA_VERSION } from '../../../contracts/schema-version.js';
import { ToolCall, ToolCallError } from '../tool.contract.js';
import { ToolCallEntity } from './tool-call.entity.js';

export class ToolCallMapper {
  static toEntity(toolCall: ToolCall): ToolCallEntity {
    const entity = new ToolCallEntity();
    entity.id = toolCall.id;
    entity.run_id = toolCall.run_id;
    entity.channel_id = toolCall.channel_id;
    entity.tool_name = toolCall.tool_name;
    entity.status = toolCall.status;
    entity.input = toolCall.input;
    entity.output = toolCall.output ?? null;
    entity.error = toolCall.error ? { ...toolCall.error } : null;
    entity.correlation_id = toolCall.correlation_id;
    entity.schema_version = toolCall.schema_version;
    entity.created_at = new Date(toolCall.created_at);
    entity.completed_at = toolCall.completed_at
      ? new Date(toolCall.completed_at)
      : null;
    return entity;
  }

  static toDomain(entity: ToolCallEntity): ToolCall {
    return {
      id: asToolCallId(entity.id),
      run_id: asRunId(entity.run_id),
      channel_id: asChannelId(entity.channel_id),
      tool_name: entity.tool_name,
      status: entity.status,
      input: entity.input,
      output: entity.output ?? undefined,
      error: (entity.error as ToolCallError | null) ?? undefined,
      correlation_id: asCorrelationId(entity.correlation_id),
      created_at: entity.created_at.toISOString(),
      completed_at: entity.completed_at?.toISOString(),
      schema_version: entity.schema_version as typeof TOOL_CALL_SCHEMA_VERSION,
    };
  }
}
