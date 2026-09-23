import {
  asAgentTaskId,
  asChannelId,
  asCorrelationId,
  asRunId,
} from '../contracts/ids.js';
import {
  AGENT_RESULT_SCHEMA_VERSION,
  RUN_SCHEMA_VERSION,
} from '../contracts/schema-version.js';
import type { HarnessRun } from '../harness/run/run.contract.js';
import { HarnessRunState } from '../harness/run/run-state.enum.js';
import { RunStep } from '../harness/run/run-step.enum.js';
import type { ChannelContext } from '../harness/runtime/contracts/channel-context.contract.js';
import {
  AgentResultValidationError,
  AgentRunStateError,
  AgentStepMismatchError,
  UnsupportedAgentTaskError,
} from './agent-runtime.errors.js';
import { AgentRuntimeService } from './agent-runtime.service.js';
import type { AgentResult, AgentTask } from './contracts/agent.contract.js';
import { AgentResultStatus, AgentTaskType } from './contracts/agent.enums.js';
import type { AgentExecutionContext } from './providers/agent-provider.types.js';
import type { LlmProvider } from './providers/llm-provider.interface.js';

const channelId = asChannelId('channel-vietnam-discovery');
const correlationId = asCorrelationId('correlation-agent-runtime');

const channelContext: ChannelContext = {
  channel: {
    channelId,
    enabled: true,
    timezone: 'Asia/Ho_Chi_Minh',
    concurrency: { maxActiveRuns: 1 },
    autonomy: { level: 'L2' },
    requiredGates: ['creative_brief'],
    limits: { maxRetriesPerStep: 2 },
    allowedTools: [
      'search_assets',
      'get_asset_metadata',
      'get_recent_analytics',
    ],
  },
  rules: [
    {
      name: 'editorial',
      relativePath: '.harness/rules/editorial.md',
      content: '# Editorial',
      checksum: 'a'.repeat(64),
    },
  ],
  skills: [
    {
      name: 'topic-research',
      relativePath: '.harness/skills/topic-research.md',
      content: '# Topic research',
      checksum: 'b'.repeat(64),
      allowedTools: ['search_assets', 'get_recent_analytics'],
    },
  ],
  memory: [
    {
      name: 'approved-knowledge',
      relativePath: '.harness/memory/approved-knowledge.md',
      content: '# Approved knowledge',
      checksum: 'c'.repeat(64),
    },
  ],
  effectiveAllowedTools: ['search_assets', 'get_recent_analytics'],
};

const createRun = (
  state: HarnessRunState,
  currentStep: RunStep | null = state === HarnessRunState.RUNNING_STEP
    ? RunStep.TOPIC_RESEARCH
    : null,
): HarnessRun => ({
  id: asRunId('run-agent-runtime'),
  channel_id: channelId,
  state,
  current_step: currentStep,
  retry_count: 0,
  max_retries: 2,
  schema_version: RUN_SCHEMA_VERSION,
  version: 4,
  created_at: '2026-09-23T00:00:00.000Z',
  updated_at: '2026-09-23T00:00:00.000Z',
});

const createSuccessResult = (task: AgentTask): AgentResult => ({
  task_id: task.task_id,
  status: AgentResultStatus.SUCCESS,
  result: {
    topic: 'Chợ nổi Cái Răng lúc bình minh',
    summary: 'Dữ liệu kiểm thử có cấu trúc.',
    candidate_asset_queries: ['floating market vietnam'],
  },
  evidence_refs: [],
  warnings: [],
  schema_version: AGENT_RESULT_SCHEMA_VERSION,
});

describe('AgentRuntimeService', () => {
  let executeProvider: ReturnType<typeof vi.fn>;
  let runtime: AgentRuntimeService;

  beforeEach(() => {
    executeProvider = vi.fn(async (task: AgentTask): Promise<AgentResult> =>
      createSuccessResult(task),
    );
    const provider: LlmProvider = {
      name: 'test-provider',
      execute: executeProvider,
    };
    runtime = new AgentRuntimeService(provider);
  });

  it('gọi provider cho RUNNING_STEP / TOPIC_RESEARCH mà không mutate Run', async () => {
    const run = createRun(HarnessRunState.RUNNING_STEP);
    const runBefore = structuredClone(run);
    const contextBefore = structuredClone(channelContext);

    const result = await runtime.execute(
      run,
      channelContext,
      AgentTaskType.TOPIC_RESEARCH,
      correlationId,
    );

    expect(result.status).toBe(AgentResultStatus.SUCCESS);
    expect(executeProvider).toHaveBeenCalledOnce();
    expect(run).toEqual(runBefore);
    expect(run.state).toBe(HarnessRunState.RUNNING_STEP);
    expect(run.current_step).toBe(RunStep.TOPIC_RESEARCH);
    expect(channelContext).toEqual(contextBefore);
  });

  it.each([HarnessRunState.SCHEDULED, HarnessRunState.PREFLIGHT])(
    'từ chối state %s bằng AgentRunStateError',
    async (state) => {
      await expect(
        runtime.execute(
          createRun(state),
          channelContext,
          AgentTaskType.TOPIC_RESEARCH,
          correlationId,
        ),
      ).rejects.toBeInstanceOf(AgentRunStateError);
      expect(executeProvider).not.toHaveBeenCalled();
    },
  );

  it('từ chối step khác TOPIC_RESEARCH bằng AgentStepMismatchError', async () => {
    await expect(
      runtime.execute(
        createRun(HarnessRunState.RUNNING_STEP, RunStep.CREATIVE_BRIEF),
        channelContext,
        AgentTaskType.TOPIC_RESEARCH,
        correlationId,
      ),
    ).rejects.toBeInstanceOf(AgentStepMismatchError);
    expect(executeProvider).not.toHaveBeenCalled();
  });

  it('từ chối task CREATIVE_BRIEF chưa được hỗ trợ', async () => {
    await expect(
      runtime.execute(
        createRun(HarnessRunState.RUNNING_STEP, RunStep.CREATIVE_BRIEF),
        channelContext,
        AgentTaskType.CREATIVE_BRIEF,
        correlationId,
      ),
    ).rejects.toBeInstanceOf(UnsupportedAgentTaskError);
    expect(executeProvider).not.toHaveBeenCalled();
  });

  it('từ chối provider result có task_id không khớp', async () => {
    executeProvider.mockImplementationOnce(
      async (task: AgentTask): Promise<AgentResult> => ({
        ...createSuccessResult(task),
        task_id: asAgentTaskId('another-task'),
      }),
    );

    await expect(
      runtime.execute(
        createRun(HarnessRunState.RUNNING_STEP),
        channelContext,
        AgentTaskType.TOPIC_RESEARCH,
        correlationId,
      ),
    ).rejects.toBeInstanceOf(AgentResultValidationError);
  });

  it('từ chối provider result không có cấu trúc hợp lệ', async () => {
    executeProvider.mockResolvedValueOnce(
      'raw provider output' as unknown as AgentResult,
    );

    await expect(
      runtime.execute(
        createRun(HarnessRunState.RUNNING_STEP),
        channelContext,
        AgentTaskType.TOPIC_RESEARCH,
        correlationId,
      ),
    ).rejects.toBeInstanceOf(AgentResultValidationError);
  });

  it('dùng đúng effectiveAllowedTools và chỉ gửi structured context', async () => {
    await runtime.execute(
      createRun(HarnessRunState.RUNNING_STEP),
      channelContext,
      AgentTaskType.TOPIC_RESEARCH,
      correlationId,
    );

    const [task, context] = executeProvider.mock.calls[0] as [
      AgentTask,
      AgentExecutionContext,
    ];
    expect(task.allowed_tools).toEqual(channelContext.effectiveAllowedTools);
    expect(task.allowed_tools).not.toBe(channelContext.effectiveAllowedTools);
    expect(task.context_refs).toEqual([
      'channel-rule:editorial',
      'skill:topic-research',
      'memory:approved-knowledge',
    ]);
    expect(context.effectiveAllowedTools).toEqual(
      channelContext.effectiveAllowedTools,
    );
    expect(context.channelRules[0]).toEqual({
      name: 'editorial',
      content: '# Editorial',
    });
    expect(context.channelRules[0]).not.toHaveProperty('relativePath');
    expect(Object.isFrozen(task.allowed_tools)).toBe(true);
    expect(Object.isFrozen(context.channelRules)).toBe(true);
  });
});
