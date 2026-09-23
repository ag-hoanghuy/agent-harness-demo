import {
  ChannelId,
  CorrelationId,
  EpisodeId,
  RunId,
} from '../../contracts/ids.js';
import { AgentTaskType } from '../contracts/agent.enums.js';

export interface AgentContextDocument {
  readonly name: string;
  readonly content: string;
}

export interface AgentExecutionContext {
  readonly channelId: ChannelId;
  readonly runId: RunId;
  readonly episodeId?: EpisodeId;
  readonly taskType: AgentTaskType;
  readonly channelRules: readonly AgentContextDocument[];
  readonly selectedSkills: readonly AgentContextDocument[];
  readonly approvedMemory: readonly AgentContextDocument[];
  readonly effectiveAllowedTools: readonly string[];
  readonly correlationId: CorrelationId;
}
