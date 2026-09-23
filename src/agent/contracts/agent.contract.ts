import {
  AGENT_RESULT_SCHEMA_VERSION,
  AGENT_TASK_SCHEMA_VERSION,
} from '../../contracts/schema-version.js';
import {
  AgentTaskId,
  ChannelId,
  EpisodeId,
  RunId,
} from '../../contracts/ids.js';
import { AgentResultStatus, AgentTaskType } from './agent.enums.js';

export interface AgentTask {
  task_id: AgentTaskId;
  run_id: RunId;
  episode_id?: EpisodeId;
  channel_id: ChannelId;
  task_type: AgentTaskType;
  allowed_tools: readonly string[];
  context_refs: readonly string[];
  schema_version: typeof AGENT_TASK_SCHEMA_VERSION;
}

export interface AgentResult {
  task_id: AgentTaskId;
  status: AgentResultStatus;
  result: Readonly<Record<string, unknown>>;
  evidence_refs: readonly string[];
  warnings: readonly string[];
  schema_version: typeof AGENT_RESULT_SCHEMA_VERSION;
}
