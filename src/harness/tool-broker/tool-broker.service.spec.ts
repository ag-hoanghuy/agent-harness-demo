import {
  asAgentTaskId,
  asChannelId,
  asCorrelationId,
  asRunId,
  type CorrelationId,
  type RunId,
  type ToolCallId,
} from '../../contracts/ids.js';
import {
  AGENT_TASK_SCHEMA_VERSION,
  RUN_SCHEMA_VERSION,
  TOOL_DEFINITION_SCHEMA_VERSION,
} from '../../contracts/schema-version.js';
import type { AgentTask } from '../../agent/contracts/agent.contract.js';
import { AgentTaskType } from '../../agent/contracts/agent.enums.js';
import type { AuditEvent } from '../audit/audit-event.contract.js';
import { AuditEventType } from '../audit/audit-event-type.enum.js';
import type { HarnessRun } from '../run/run.contract.js';
import { HarnessRunState } from '../run/run-state.enum.js';
import { RunStep } from '../run/run-step.enum.js';
import type { ChannelContext } from '../runtime/contracts/channel-context.contract.js';
import { RuntimeStoreService } from '../../database/runtime-store.service.js';
import {
  ToolExecutionError,
  ToolRunStateError,
  ToolScopeMismatchError,
} from './tool-broker.errors.js';
import { ToolBrokerService } from './tool-broker.service.js';
import type {
  ToolCallRepository,
  ToolCallStatusUpdate,
} from './tool-call.repository.js';
import { ToolCallStatus } from './tool-call-status.enum.js';
import type { ToolCall, ToolDefinition } from './tool.contract.js';
import type {
  RegisteredTool,
  ToolExecutionRequest,
  ToolExecutor,
} from './tool-executor.interface.js';
import { ToolRegistryService } from './tool-registry.service.js';
import { ToolSchemaValidatorService } from './tool-schema-validator.service.js';

const channelId = asChannelId('channel-vietnam-discovery');
const runId = asRunId('run-tool-broker');

const createRun = (
  state = HarnessRunState.RUNNING_STEP,
  overrides: Partial<HarnessRun> = {},
): HarnessRun => ({
  id: runId,
  channel_id: channelId,
  state,
  current_step: RunStep.TOPIC_RESEARCH,
  retry_count: 0,
  max_retries: 2,
  schema_version: RUN_SCHEMA_VERSION,
  version: 4,
  created_at: '2026-09-23T00:00:00.000Z',
  updated_at: '2026-09-23T00:00:00.000Z',
  ...overrides,
});

const createTask = (overrides: Partial<AgentTask> = {}): AgentTask => ({
  task_id: asAgentTaskId('task-tool-broker'),
  run_id: runId,
  channel_id: channelId,
  task_type: AgentTaskType.TOPIC_RESEARCH,
  allowed_tools: ['search_assets'],
  context_refs: ['skill:topic-research'],
  schema_version: AGENT_TASK_SCHEMA_VERSION,
  ...overrides,
});

const createContext = (
  effectiveAllowedTools: readonly string[] = ['search_assets'],
  contextChannelId = channelId,
): ChannelContext => ({
  channel: {
    channelId: contextChannelId,
    enabled: true,
    timezone: 'Asia/Ho_Chi_Minh',
    concurrency: { maxActiveRuns: 1 },
    autonomy: { level: 'L2' },
    requiredGates: [],
    limits: { maxRetriesPerStep: 2 },
    allowedTools: ['search_assets'],
  },
  rules: [],
  skills: [],
  memory: [],
  effectiveAllowedTools,
});

const createRequest = (
  correlationId = asCorrelationId('tool-invocation-1'),
  input: unknown = { query: 'floating market' },
): ToolExecutionRequest => ({
  toolName: 'search_assets',
  input,
  actor: 'unit-test',
  correlationId,
});

const createDefinition = (
  overrides: Partial<ToolDefinition> = {},
): ToolDefinition => ({
  name: 'search_assets',
  schema_version: TOOL_DEFINITION_SCHEMA_VERSION,
  required_permissions: [],
  input_schema: {
    type: 'object',
    required: ['query'],
    additionalProperties: false,
    properties: {
      query: { type: 'string', minLength: 1 },
    },
  },
  output_schema: {
    type: 'object',
    required: ['assets'],
    additionalProperties: false,
    properties: {
      assets: { type: 'array' },
    },
  },
  timeout_ms: 1_000,
  max_retries: 0,
  idempotent: true,
  side_effect: false,
  ...overrides,
});

class ToolStoreHarness implements ToolCallRepository {
  readonly calls = new Map<ToolCallId, ToolCall>();
  readonly audits: AuditEvent[] = [];

  async create(toolCall: ToolCall): Promise<ToolCall> {
    this.calls.set(toolCall.id, toolCall);
    return toolCall;
  }

  async updateStatus(
    id: ToolCallId,
    update: ToolCallStatusUpdate,
  ): Promise<ToolCall> {
    const current = this.calls.get(id);
    if (current === undefined) {
      throw new Error('Missing ToolCall in test harness');
    }
    const updated: ToolCall = {
      ...current,
      status: update.status,
      output: update.output,
      error: update.error,
      completed_at: update.completed_at,
    };
    this.calls.set(id, updated);
    return updated;
  }

  async findById(id: ToolCallId): Promise<ToolCall | null> {
    return this.calls.get(id) ?? null;
  }

  async findByRunId(targetRunId: RunId): Promise<readonly ToolCall[]> {
    return [...this.calls.values()].filter(
      (toolCall) => toolCall.run_id === targetRunId,
    );
  }

  async findByInvocation(
    targetRunId: RunId,
    toolName: string,
    correlationId: CorrelationId,
  ): Promise<ToolCall | null> {
    return (
      [...this.calls.values()].find(
        (toolCall) =>
          toolCall.run_id === targetRunId &&
          toolCall.tool_name === toolName &&
          toolCall.correlation_id === correlationId,
      ) ?? null
    );
  }
}

describe('ToolBrokerService', () => {
  let store: ToolStoreHarness;
  let runtimeStore: {
    createToolCallWithAudit: ReturnType<typeof vi.fn>;
    updateToolCall: ReturnType<typeof vi.fn>;
    updateToolCallWithAudit: ReturnType<typeof vi.fn>;
  };
  let registry: ToolRegistryService;
  let broker: ToolBrokerService;

  beforeEach(() => {
    store = new ToolStoreHarness();
    runtimeStore = {
      createToolCallWithAudit: vi.fn(
        async (toolCall: ToolCall, audit: AuditEvent): Promise<ToolCall> => {
          const saved = await store.create(toolCall);
          store.audits.push(audit);
          return saved;
        },
      ),
      updateToolCall: vi.fn(
        async (
          id: ToolCallId,
          update: ToolCallStatusUpdate,
        ): Promise<ToolCall> => store.updateStatus(id, update),
      ),
      updateToolCallWithAudit: vi.fn(
        async (
          id: ToolCallId,
          update: ToolCallStatusUpdate,
          audit: AuditEvent,
        ): Promise<ToolCall> => {
          const saved = await store.updateStatus(id, update);
          store.audits.push(audit);
          return saved;
        },
      ),
    };
    const schemas = new ToolSchemaValidatorService();
    registry = new ToolRegistryService(schemas);
    broker = new ToolBrokerService(
      store,
      runtimeStore as unknown as RuntimeStoreService,
      registry,
      schemas,
    );
  });

  const register = (
    executor: ToolExecutor,
    definition: ToolDefinition = createDefinition(),
  ): RegisteredTool => {
    const tool = { definition, executor };
    registry.register(tool);
    return tool;
  };

  it('authorize, execute và persist lifecycle thành công', async () => {
    const execute = vi.fn().mockResolvedValue({
      assets: [{ id: 'asset-001', title: 'Mock floating market footage' }],
    });
    register({ execute });
    const run = createRun();
    const runBefore = structuredClone(run);

    const result = await broker.execute(
      run,
      createTask(),
      createContext(),
      createRequest(),
    );

    expect(result.status).toBe(ToolCallStatus.SUCCEEDED);
    expect(result.output).toEqual({
      assets: [{ id: 'asset-001', title: 'Mock floating market footage' }],
    });
    expect(execute).toHaveBeenCalledOnce();
    expect(store.audits.map(({ event_type }) => event_type)).toEqual([
      AuditEventType.TOOL_REQUESTED,
      AuditEventType.TOOL_ALLOWED,
      AuditEventType.TOOL_COMPLETED,
    ]);
    expect(run).toEqual(runBefore);
  });

  it.each([
    {
      name: 'tool không nằm trong AgentTask.allowed_tools',
      task: createTask({ allowed_tools: [] }),
      context: createContext(),
      registerTool: true,
      errorCode: 'TOOL_NOT_ALLOWED',
    },
    {
      name: 'tool không nằm trong context.effectiveAllowedTools',
      task: createTask(),
      context: createContext([]),
      registerTool: true,
      errorCode: 'TOOL_NOT_ALLOWED',
    },
    {
      name: 'tool không registered',
      task: createTask(),
      context: createContext(),
      registerTool: false,
      errorCode: 'TOOL_NOT_REGISTERED',
    },
  ])('DENIED khi $name', async ({ task, context, registerTool, errorCode }) => {
    const execute = vi.fn().mockResolvedValue({ assets: [] });
    if (registerTool) {
      register({ execute });
    }

    const result = await broker.execute(
      createRun(),
      task,
      context,
      createRequest(),
    );

    expect(result.status).toBe(ToolCallStatus.DENIED);
    expect(result.error?.code).toBe(errorCode);
    expect(execute).not.toHaveBeenCalled();
    expect(store.audits.map(({ event_type }) => event_type)).toEqual([
      AuditEventType.TOOL_REQUESTED,
      AuditEventType.TOOL_DENIED,
    ]);
  });

  it.each([
    {
      name: 'run.id khác task.run_id',
      run: createRun(),
      task: createTask({ run_id: asRunId('other-run') }),
      context: createContext(),
    },
    {
      name: 'run.channel_id khác task.channel_id',
      run: createRun(),
      task: createTask({ channel_id: asChannelId('other-channel') }),
      context: createContext(),
    },
    {
      name: 'task channel khác context channel trong trusted scope',
      run: createRun(undefined, {
        channel_id: asChannelId('other-channel'),
      }),
      task: createTask({ channel_id: asChannelId('other-channel') }),
      context: createContext(),
    },
  ])('reject scope mismatch: $name', async ({ run, task, context }) => {
    const execute = vi.fn().mockResolvedValue({ assets: [] });
    register({ execute });

    await expect(
      broker.execute(run, task, context, createRequest()),
    ).rejects.toBeInstanceOf(ToolScopeMismatchError);
    expect(execute).not.toHaveBeenCalled();
    expect(store.calls.size).toBe(0);
  });

  it.each([
    HarnessRunState.SCHEDULED,
    HarnessRunState.PREFLIGHT,
    HarnessRunState.COMPLETED,
  ])('reject Run state %s', async (state) => {
    const execute = vi.fn().mockResolvedValue({ assets: [] });
    register({ execute });

    await expect(
      broker.execute(
        createRun(state),
        createTask(),
        createContext(),
        createRequest(),
      ),
    ).rejects.toBeInstanceOf(ToolRunStateError);
    expect(execute).not.toHaveBeenCalled();
  });

  it('DENIED input sai schema và không gọi executor', async () => {
    const execute = vi.fn().mockResolvedValue({ assets: [] });
    register({ execute });

    const result = await broker.execute(
      createRun(),
      createTask(),
      createContext(),
      createRequest(asCorrelationId('invalid-input'), { query: '' }),
    );

    expect(result.status).toBe(ToolCallStatus.DENIED);
    expect(result.error?.code).toBe('INVALID_TOOL_INPUT');
    expect(execute).not.toHaveBeenCalled();
  });

  it('FAILED khi executor trả output sai schema', async () => {
    const execute = vi.fn().mockResolvedValue({ results: [] });
    register({ execute });

    const result = await broker.execute(
      createRun(),
      createTask(),
      createContext(),
      createRequest(asCorrelationId('invalid-output')),
    );

    expect(result.status).toBe(ToolCallStatus.FAILED);
    expect(result.error?.code).toBe('INVALID_TOOL_OUTPUT');
    expect(result.output).toBeUndefined();
  });

  it('FAILED với TOOL_TIMEOUT mà không treo', async () => {
    let receivedSignal: AbortSignal | undefined;
    const execute = vi.fn(
      async (
        _input: unknown,
        _context: unknown,
        signal?: AbortSignal,
      ): Promise<unknown> =>
        new Promise(() => {
          receivedSignal = signal;
          // Test double cố ý không resolve; Broker timeout kết thúc việc chờ.
        }),
    );
    register({ execute }, createDefinition({ timeout_ms: 10 }));

    const result = await broker.execute(
      createRun(),
      createTask(),
      createContext(),
      createRequest(asCorrelationId('timeout')),
    );

    expect(result.status).toBe(ToolCallStatus.FAILED);
    expect(result.error?.code).toBe('TOOL_TIMEOUT');
    expect(execute).toHaveBeenCalledOnce();
    expect(receivedSignal?.aborted).toBe(true);
  });

  it('retry lỗi retryable có giới hạn cho tool idempotent', async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(
        new ToolExecutionError('TEMPORARY_FAILURE', 'Tạm lỗi', true),
      )
      .mockRejectedValueOnce(
        new ToolExecutionError('TEMPORARY_FAILURE', 'Tạm lỗi', true),
      )
      .mockResolvedValueOnce({ assets: [] });
    register(
      { execute },
      createDefinition({ idempotent: true, max_retries: 2 }),
    );

    const result = await broker.execute(
      createRun(),
      createTask(),
      createContext(),
      createRequest(asCorrelationId('retry-success')),
    );

    expect(result.status).toBe(ToolCallStatus.SUCCEEDED);
    expect(execute).toHaveBeenCalledTimes(3);
  });

  it.each([
    { sideEffect: false, label: 'non-idempotent' },
    { sideEffect: true, label: 'side-effect non-idempotent' },
  ])('không retry tool $label', async ({ sideEffect }) => {
    const execute = vi
      .fn()
      .mockRejectedValue(
        new ToolExecutionError('TEMPORARY_FAILURE', 'Tạm lỗi', true),
      );
    register(
      { execute },
      createDefinition({
        idempotent: false,
        side_effect: sideEffect,
        max_retries: 2,
      }),
    );

    const result = await broker.execute(
      createRun(),
      createTask(),
      createContext(),
      createRequest(asCorrelationId(`no-retry-${String(sideEffect)}`)),
    );

    expect(result.status).toBe(ToolCallStatus.FAILED);
    expect(execute).toHaveBeenCalledOnce();
  });

  it('reuse SUCCEEDED ToolCall theo invocation key và không execute lại', async () => {
    const execute = vi.fn().mockResolvedValue({ assets: [] });
    register({ execute });
    const request = createRequest(asCorrelationId('idempotent-invocation'));

    const first = await broker.execute(
      createRun(),
      createTask(),
      createContext(),
      request,
    );
    const second = await broker.execute(
      createRun(),
      createTask(),
      createContext(),
      request,
    );

    expect(second).toEqual(first);
    expect(execute).toHaveBeenCalledOnce();
    expect(store.calls.size).toBe(1);
    expect(store.audits).toHaveLength(3);
  });
});
