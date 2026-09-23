import type { ChannelId, RunId } from '../contracts/ids.js';
import type { AgentTaskType } from './contracts/agent.enums.js';
import type { HarnessRunState } from '../harness/run/run-state.enum.js';
import type { RunStep } from '../harness/run/run-step.enum.js';

export class AgentRunStateError extends Error {
  constructor(runId: RunId, actualState: HarnessRunState) {
    super(
      `Run ${runId} không thể gọi Agent ở state ${actualState}; yêu cầu RUNNING_STEP`,
    );
    this.name = 'AgentRunStateError';
  }
}

export class AgentStepMismatchError extends Error {
  constructor(runId: RunId, actualStep: RunStep | null, expectedStep: RunStep) {
    super(
      `Run ${runId} đang ở step ${actualStep ?? 'null'}; Agent yêu cầu ${expectedStep}`,
    );
    this.name = 'AgentStepMismatchError';
  }
}

export class UnsupportedAgentTaskError extends Error {
  constructor(taskType: AgentTaskType) {
    super(`Agent task chưa được hỗ trợ trong Part 06: ${taskType}`);
    this.name = 'UnsupportedAgentTaskError';
  }
}

export class AgentContextMismatchError extends Error {
  constructor(
    runId: RunId,
    runChannelId: ChannelId,
    contextChannelId: ChannelId,
  ) {
    super(
      `ChannelContext ${contextChannelId} không thuộc Run ${runId} của channel ${runChannelId}`,
    );
    this.name = 'AgentContextMismatchError';
  }
}

export class AgentResultValidationError extends Error {
  constructor(reason: string) {
    super(`AgentResult không hợp lệ: ${reason}`);
    this.name = 'AgentResultValidationError';
  }
}
