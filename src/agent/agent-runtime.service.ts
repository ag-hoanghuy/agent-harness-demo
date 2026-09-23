import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { asAgentTaskId, type CorrelationId } from '../contracts/ids.js';
import { AGENT_TASK_SCHEMA_VERSION } from '../contracts/schema-version.js';
import type { HarnessRun } from '../harness/run/run.contract.js';
import { HarnessRunState } from '../harness/run/run-state.enum.js';
import { RunStep } from '../harness/run/run-step.enum.js';
import type { ChannelContext } from '../harness/runtime/contracts/channel-context.contract.js';
import { validateAgentResult } from './agent-result.validator.js';
import {
  AgentContextMismatchError,
  AgentRunStateError,
  AgentStepMismatchError,
  UnsupportedAgentTaskError,
} from './agent-runtime.errors.js';
import type { AgentResult, AgentTask } from './contracts/agent.contract.js';
import { AgentTaskType } from './contracts/agent.enums.js';
import type {
  AgentContextDocument,
  AgentExecutionContext,
} from './providers/agent-provider.types.js';
import {
  LLM_PROVIDER,
  type LlmProvider,
} from './providers/llm-provider.interface.js';

const SUPPORTED_TASK_STEPS: Readonly<Partial<Record<AgentTaskType, RunStep>>> =
  Object.freeze({
    [AgentTaskType.TOPIC_RESEARCH]: RunStep.TOPIC_RESEARCH,
  });

const copyDocuments = (
  documents: ChannelContext['rules'],
): readonly AgentContextDocument[] =>
  Object.freeze(
    documents.map((document) =>
      Object.freeze({ name: document.name, content: document.content }),
    ),
  );

@Injectable()
export class AgentRuntimeService {
  constructor(
    @Inject(LLM_PROVIDER)
    private readonly provider: LlmProvider,
  ) {}

  async execute(
    run: HarnessRun,
    channelContext: ChannelContext,
    taskType: AgentTaskType,
    correlationId: CorrelationId,
  ): Promise<AgentResult> {
    this.assertCanExecute(run, channelContext, taskType);

    const task = this.createTask(run, channelContext, taskType);
    const executionContext = this.createExecutionContext(
      run,
      channelContext,
      taskType,
      correlationId,
    );
    const result = await this.provider.execute(task, executionContext);

    return validateAgentResult(result, task);
  }

  private assertCanExecute(
    run: HarnessRun,
    channelContext: ChannelContext,
    taskType: AgentTaskType,
  ): void {
    if (run.state !== HarnessRunState.RUNNING_STEP) {
      throw new AgentRunStateError(run.id, run.state);
    }

    const expectedStep = SUPPORTED_TASK_STEPS[taskType];
    if (expectedStep === undefined) {
      throw new UnsupportedAgentTaskError(taskType);
    }
    if (run.current_step !== expectedStep) {
      throw new AgentStepMismatchError(run.id, run.current_step, expectedStep);
    }
    if (channelContext.channel.channelId !== run.channel_id) {
      throw new AgentContextMismatchError(
        run.id,
        run.channel_id,
        channelContext.channel.channelId,
      );
    }
  }

  private createTask(
    run: HarnessRun,
    channelContext: ChannelContext,
    taskType: AgentTaskType,
  ): AgentTask {
    return Object.freeze({
      task_id: asAgentTaskId(randomUUID()),
      run_id: run.id,
      episode_id: run.episode_id,
      channel_id: run.channel_id,
      task_type: taskType,
      allowed_tools: Object.freeze([...channelContext.effectiveAllowedTools]),
      context_refs: Object.freeze([
        ...channelContext.rules.map((rule) => `channel-rule:${rule.name}`),
        ...channelContext.skills.map((skill) => `skill:${skill.name}`),
        ...channelContext.memory.map((memory) => `memory:${memory.name}`),
      ]),
      schema_version: AGENT_TASK_SCHEMA_VERSION,
    });
  }

  private createExecutionContext(
    run: HarnessRun,
    channelContext: ChannelContext,
    taskType: AgentTaskType,
    correlationId: CorrelationId,
  ): AgentExecutionContext {
    return Object.freeze({
      channelId: run.channel_id,
      runId: run.id,
      episodeId: run.episode_id,
      taskType,
      channelRules: copyDocuments(channelContext.rules),
      selectedSkills: copyDocuments(channelContext.skills),
      approvedMemory: copyDocuments(channelContext.memory),
      effectiveAllowedTools: Object.freeze([
        ...channelContext.effectiveAllowedTools,
      ]),
      correlationId,
    });
  }
}
