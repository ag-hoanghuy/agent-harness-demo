import { AGENT_RESULT_SCHEMA_VERSION } from '../contracts/schema-version.js';
import type { AgentResult, AgentTask } from './contracts/agent.contract.js';
import { AgentResultStatus, AgentTaskType } from './contracts/agent.enums.js';
import type { TopicResearchResult } from './contracts/topic-research-result.contract.js';
import { AgentResultValidationError } from './agent-runtime.errors.js';

const AGENT_RESULT_STATUSES = new Set<string>(Object.values(AgentResultStatus));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

export const validateTopicResearchResult = (
  value: unknown,
): TopicResearchResult => {
  if (!isRecord(value)) {
    throw new AgentResultValidationError(
      'result của TOPIC_RESEARCH phải là object có cấu trúc',
    );
  }
  if (!isNonEmptyString(value.topic)) {
    throw new AgentResultValidationError(
      'TOPIC_RESEARCH result.topic phải là chuỗi không rỗng',
    );
  }
  if (!isNonEmptyString(value.summary)) {
    throw new AgentResultValidationError(
      'TOPIC_RESEARCH result.summary phải là chuỗi không rỗng',
    );
  }
  if (!isStringArray(value.candidate_asset_queries)) {
    throw new AgentResultValidationError(
      'TOPIC_RESEARCH result.candidate_asset_queries phải là mảng chuỗi',
    );
  }

  return value as unknown as TopicResearchResult;
};

export const validateAgentResult = (
  value: unknown,
  task: AgentTask,
): AgentResult => {
  if (!isRecord(value)) {
    throw new AgentResultValidationError(
      'provider phải trả object, không chấp nhận raw string',
    );
  }
  if (value.task_id !== task.task_id) {
    throw new AgentResultValidationError('task_id không khớp AgentTask');
  }
  if (
    typeof value.status !== 'string' ||
    !AGENT_RESULT_STATUSES.has(value.status)
  ) {
    throw new AgentResultValidationError('status không hợp lệ');
  }
  if (value.schema_version !== AGENT_RESULT_SCHEMA_VERSION) {
    throw new AgentResultValidationError(
      `schema_version phải là ${AGENT_RESULT_SCHEMA_VERSION}`,
    );
  }
  if (!isStringArray(value.evidence_refs)) {
    throw new AgentResultValidationError('evidence_refs phải là mảng chuỗi');
  }
  if (!isStringArray(value.warnings)) {
    throw new AgentResultValidationError('warnings phải là mảng chuỗi');
  }
  if (!isRecord(value.result)) {
    const reason =
      value.status === AgentResultStatus.SUCCESS
        ? 'result phải tồn tại khi status là SUCCESS'
        : 'result phải là object theo AgentResult contract hiện tại';
    throw new AgentResultValidationError(reason);
  }

  if (task.task_type === AgentTaskType.TOPIC_RESEARCH) {
    validateTopicResearchResult(value.result);
  }

  return value as unknown as AgentResult;
};
