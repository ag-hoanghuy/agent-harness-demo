import { asChannelId, asCorrelationId, asRunId } from '../../contracts/ids.js';
import { RUN_SCHEMA_VERSION } from '../../contracts/schema-version.js';
import { RuntimeStoreService } from '../../database/runtime-store.service.js';
import { AuditEvent } from '../audit/audit-event.contract.js';
import { AuditEventType } from '../audit/audit-event-type.enum.js';
import { Checkpoint } from '../checkpoint/checkpoint.contract.js';
import { RunPolicyService } from '../control-plane/run-policy.service.js';
import { HarnessRun } from '../run/run.contract.js';
import { RunVersionConflictError } from '../run/run.errors.js';
import { RunRepository } from '../run/run.repository.js';
import { HarnessRunState } from '../run/run-state.enum.js';
import { RunStep } from '../run/run-step.enum.js';
import { ContextLoaderService } from '../runtime/context-loader.service.js';
import { InvalidChannelConfigError } from '../runtime/channel-runtime.errors.js';
import { ChannelConfig } from '../runtime/contracts/channel-config.contract.js';
import { ChannelContext } from '../runtime/contracts/channel-context.contract.js';
import {
  ChannelDisabledError,
  RunCapacityExceededError,
} from './run-orchestrator.errors.js';
import { HarnessRunOrchestrator } from './run-orchestrator.service.js';
import { RuntimeIdFactory } from './runtime-id.factory.js';

const channelId = asChannelId('channel-vietnam-discovery');
const correlationId = asCorrelationId('correlation-test');

const channelConfig: ChannelConfig = {
  channelId,
  enabled: true,
  timezone: 'Asia/Ho_Chi_Minh',
  concurrency: { maxActiveRuns: 1 },
  autonomy: { level: 'L2' },
  requiredGates: ['creative_brief'],
  limits: { maxRetriesPerStep: 2 },
  allowedTools: ['search_assets', 'get_recent_analytics'],
};

const channelContext: ChannelContext = {
  channel: channelConfig,
  rules: [
    {
      name: 'editorial',
      relativePath: '.harness/rules/editorial.md',
      content: '# Rule',
      checksum: 'a'.repeat(64),
    },
  ],
  skills: [
    {
      name: 'topic-research',
      relativePath: '.harness/skills/topic-research.md',
      content: '# Skill',
      checksum: 'b'.repeat(64),
      allowedTools: ['search_assets'],
    },
  ],
  memory: [
    {
      name: 'approved-knowledge',
      relativePath: '.harness/memory/approved-knowledge.md',
      content: '# Memory',
      checksum: 'c'.repeat(64),
    },
  ],
  effectiveAllowedTools: ['search_assets'],
};

const createRun = (
  state: HarnessRunState,
  version = 1,
  id = 'run-test',
): HarnessRun => ({
  id: asRunId(id),
  channel_id: channelId,
  state,
  current_step:
    state === HarnessRunState.RUNNING_STEP ? RunStep.TOPIC_RESEARCH : null,
  retry_count: 0,
  max_retries: 2,
  schema_version: RUN_SCHEMA_VERSION,
  version,
  created_at: '2026-09-23T00:00:00.000Z',
  updated_at: '2026-09-23T00:00:00.000Z',
});

interface RuntimeStoreMock {
  readonly createRunWithAudit: ReturnType<typeof vi.fn>;
  readonly saveRunWithAudits: ReturnType<typeof vi.fn>;
  readonly saveRunWithCheckpointAndAudits: ReturnType<typeof vi.fn>;
}

describe('HarnessRunOrchestrator', () => {
  let runRepository: RunRepository;
  let runtimeStore: RuntimeStoreMock;
  let contextLoader: {
    loadChannelConfig: ReturnType<typeof vi.fn>;
    loadChannelContext: ReturnType<typeof vi.fn>;
  };
  let orchestrator: HarnessRunOrchestrator;
  let findRunById: ReturnType<typeof vi.fn>;
  let findActiveRuns: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    findRunById = vi.fn();
    findActiveRuns = vi.fn().mockResolvedValue([]);
    runRepository = {
      create: vi.fn(),
      findById: findRunById,
      save: vi.fn(),
      findActiveByChannel: findActiveRuns,
    };
    runtimeStore = {
      createRunWithAudit: vi.fn(
        async (run: HarnessRun): Promise<HarnessRun> => run,
      ),
      saveRunWithAudits: vi.fn(
        async (
          run: HarnessRun,
          expectedVersion: number,
        ): Promise<HarnessRun> => ({
          ...run,
          version: expectedVersion + 1,
        }),
      ),
      saveRunWithCheckpointAndAudits: vi.fn(
        async (
          run: HarnessRun,
          expectedVersion: number,
        ): Promise<HarnessRun> => ({
          ...run,
          version: expectedVersion + 1,
        }),
      ),
    };
    contextLoader = {
      loadChannelConfig: vi.fn().mockResolvedValue(channelConfig),
      loadChannelContext: vi.fn().mockResolvedValue(channelContext),
    };
    orchestrator = new HarnessRunOrchestrator(
      runRepository,
      runtimeStore as unknown as RuntimeStoreService,
      contextLoader as unknown as ContextLoaderService,
      new RunPolicyService(),
      new RuntimeIdFactory(),
    );
  });

  it('tạo Run SCHEDULED với channel, retry policy và RUN_CREATED audit', async () => {
    const run = await orchestrator.createRun({
      channelId,
      correlationId,
      actor: 'operator',
    });

    expect(run.state).toBe(HarnessRunState.SCHEDULED);
    expect(run.channel_id).toBe(channelId);
    expect(run.max_retries).toBe(2);
    expect(run.retry_count).toBe(0);
    expect(run.current_step).toBeNull();
    const [, auditEvent] = runtimeStore.createRunWithAudit.mock.calls[0] as [
      HarnessRun,
      AuditEvent,
    ];
    expect(auditEvent.event_type).toBe(AuditEventType.RUN_CREATED);
    expect(auditEvent.correlation_id).toBe(correlationId);
  });

  it('từ chối tạo Run khi channel bị tắt', async () => {
    contextLoader.loadChannelConfig.mockResolvedValue({
      ...channelConfig,
      enabled: false,
    });

    await expect(
      orchestrator.createRun({
        channelId,
        correlationId,
        actor: 'operator',
      }),
    ).rejects.toBeInstanceOf(ChannelDisabledError);
    expect(runtimeStore.createRunWithAudit).not.toHaveBeenCalled();
  });

  it('queue SCHEDULED → QUEUED bằng transition helper và audit', async () => {
    findRunById.mockResolvedValue(createRun(HarnessRunState.SCHEDULED));

    const queued = await orchestrator.queueRun({
      runId: asRunId('run-test'),
      expectedVersion: 1,
      correlationId,
      actor: 'scheduler',
    });

    expect(queued.state).toBe(HarnessRunState.QUEUED);
    expect(queued.version).toBe(2);
    const [, expectedVersion, audits] = runtimeStore.saveRunWithAudits.mock
      .calls[0] as [HarnessRun, number, AuditEvent[]];
    expect(expectedVersion).toBe(1);
    expect(audits.map((event) => event.event_type)).toEqual([
      AuditEventType.RUN_STATE_CHANGED,
    ]);
  });

  it('từ chối queue với expectedVersion cũ', async () => {
    findRunById.mockResolvedValue(createRun(HarnessRunState.SCHEDULED, 2));

    await expect(
      orchestrator.queueRun({
        runId: asRunId('run-test'),
        expectedVersion: 1,
        correlationId,
        actor: 'scheduler',
      }),
    ).rejects.toBeInstanceOf(RunVersionConflictError);
    expect(runtimeStore.saveRunWithAudits).not.toHaveBeenCalled();
  });

  it('từ chối queue từ RUNNING_STEP', async () => {
    findRunById.mockResolvedValue(createRun(HarnessRunState.RUNNING_STEP));

    await expect(
      orchestrator.queueRun({
        runId: asRunId('run-test'),
        expectedVersion: 1,
        correlationId,
        actor: 'scheduler',
      }),
    ).rejects.toThrow('RUNNING_STEP -> QUEUED');
  });

  it('preflight QUEUED → PREFLIGHT → RUNNING_STEP và tạo snapshot checkpoint', async () => {
    findRunById.mockResolvedValue(createRun(HarnessRunState.QUEUED, 2));

    const ready = await orchestrator.preflightRun({
      runId: asRunId('run-test'),
      expectedVersion: 2,
      correlationId,
      actor: 'worker',
    });

    expect(ready.state).toBe(HarnessRunState.RUNNING_STEP);
    expect(ready.current_step).toBe(RunStep.TOPIC_RESEARCH);
    expect(ready.version).toBe(4);
    expect(contextLoader.loadChannelContext).toHaveBeenCalledWith(channelId, {
      skills: ['topic-research'],
    });

    const [, finalExpectedVersion, checkpoint, audits] = runtimeStore
      .saveRunWithCheckpointAndAudits.mock.calls[0] as [
      HarnessRun,
      number,
      Checkpoint,
      AuditEvent[],
    ];
    expect(finalExpectedVersion).toBe(3);
    expect(checkpoint.step).toBe(RunStep.PRECHECK);
    expect(checkpoint.run_state).toBe(HarnessRunState.RUNNING_STEP);
    expect(checkpoint.context_snapshot?.rules[0].checksum).toBe('a'.repeat(64));
    expect(checkpoint.context_snapshot?.effectiveAllowedTools).toEqual([
      'search_assets',
    ]);
    expect(audits.map((event) => event.event_type)).toEqual([
      AuditEventType.STEP_COMPLETED,
      AuditEventType.RUN_STATE_CHANGED,
    ]);
  });

  it('đưa Run vào BLOCKED nếu channel bị tắt trong preflight', async () => {
    findRunById.mockResolvedValue(createRun(HarnessRunState.QUEUED, 2));
    contextLoader.loadChannelContext.mockResolvedValue({
      ...channelContext,
      channel: { ...channelConfig, enabled: false },
    });

    await expect(
      orchestrator.preflightRun({
        runId: asRunId('run-test'),
        expectedVersion: 2,
        correlationId,
        actor: 'worker',
      }),
    ).rejects.toBeInstanceOf(ChannelDisabledError);

    const [blockedRun] = runtimeStore.saveRunWithAudits.mock.calls[1] as [
      HarnessRun,
    ];
    expect(blockedRun.state).toBe(HarnessRunState.BLOCKED);
    expect(runtimeStore.saveRunWithCheckpointAndAudits).not.toHaveBeenCalled();
  });

  it('không tự tính Run hiện tại nhưng BLOCKED khi có Run khác chiếm capacity', async () => {
    const currentRun = createRun(HarnessRunState.QUEUED, 2);
    findRunById.mockResolvedValue(currentRun);
    findActiveRuns.mockResolvedValue([
      { ...currentRun, state: HarnessRunState.PREFLIGHT, version: 3 },
      createRun(HarnessRunState.RUNNING_STEP, 4, 'run-other'),
    ]);

    await expect(
      orchestrator.preflightRun({
        runId: currentRun.id,
        expectedVersion: 2,
        correlationId,
        actor: 'worker',
      }),
    ).rejects.toBeInstanceOf(RunCapacityExceededError);

    const [blockedRun] = runtimeStore.saveRunWithAudits.mock.calls[1] as [
      HarnessRun,
    ];
    expect(blockedRun.state).toBe(HarnessRunState.BLOCKED);
  });

  it('đưa Run vào FAILED_FINAL khi channel config không hợp lệ', async () => {
    findRunById.mockResolvedValue(createRun(HarnessRunState.QUEUED, 2));
    contextLoader.loadChannelContext.mockRejectedValue(
      new InvalidChannelConfigError('fixture lỗi'),
    );

    await expect(
      orchestrator.preflightRun({
        runId: asRunId('run-test'),
        expectedVersion: 2,
        correlationId,
        actor: 'worker',
      }),
    ).rejects.toBeInstanceOf(InvalidChannelConfigError);

    const [failedRun, , audits] = runtimeStore.saveRunWithAudits.mock
      .calls[1] as [HarnessRun, number, AuditEvent[]];
    expect(failedRun.state).toBe(HarnessRunState.FAILED_FINAL);
    expect(audits.map(({ event_type }) => event_type)).toEqual([
      AuditEventType.RUN_STATE_CHANGED,
      AuditEventType.RUN_FAILED,
    ]);
  });
});
