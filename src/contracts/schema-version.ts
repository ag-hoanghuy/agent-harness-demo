export const RUN_SCHEMA_VERSION = 'run-1.0' as const;
export const GATE_SCHEMA_VERSION = 'gate-1.0' as const;
export const ARTIFACT_SCHEMA_VERSION = 'artifact-1.0' as const;
export const TOOL_DEFINITION_SCHEMA_VERSION = 'tool-definition-1.1' as const;
export const TOOL_CALL_SCHEMA_VERSION = 'tool-call-1.0' as const;
export const AGENT_TASK_SCHEMA_VERSION = 'agent-task-1.0' as const;
export const AGENT_RESULT_SCHEMA_VERSION = 'agent-result-1.0' as const;
export const CHECKPOINT_SCHEMA_VERSION = 'checkpoint-1.0' as const;
export const AUDIT_EVENT_SCHEMA_VERSION = 'audit-event-1.0' as const;

export type SchemaVersion =
  | typeof RUN_SCHEMA_VERSION
  | typeof GATE_SCHEMA_VERSION
  | typeof ARTIFACT_SCHEMA_VERSION
  | typeof TOOL_DEFINITION_SCHEMA_VERSION
  | typeof TOOL_CALL_SCHEMA_VERSION
  | typeof AGENT_TASK_SCHEMA_VERSION
  | typeof AGENT_RESULT_SCHEMA_VERSION
  | typeof CHECKPOINT_SCHEMA_VERSION
  | typeof AUDIT_EVENT_SCHEMA_VERSION;
