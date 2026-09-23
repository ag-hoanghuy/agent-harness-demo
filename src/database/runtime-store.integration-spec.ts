import { DataSource } from 'typeorm';
import {
  asArtifactId,
  asAuditEventId,
  asChannelId,
  asCheckpointId,
  asCorrelationId,
  asRunId,
  asToolCallId,
  RunId,
} from '../contracts/ids.js';
import {
  AUDIT_EVENT_SCHEMA_VERSION,
  CHECKPOINT_SCHEMA_VERSION,
  RUN_SCHEMA_VERSION,
  TOOL_CALL_SCHEMA_VERSION,
} from '../contracts/schema-version.js';
import { AuditEvent } from '../harness/audit/audit-event.contract.js';
import { AuditEventType } from '../harness/audit/audit-event-type.enum.js';
import { AuditEventEntity } from '../harness/audit/persistence/audit-event.entity.js';
import { TypeOrmAuditEventRepository } from '../harness/audit/persistence/typeorm-audit-event.repository.js';
import { Checkpoint } from '../harness/checkpoint/checkpoint.contract.js';
import { CheckpointEntity } from '../harness/checkpoint/persistence/checkpoint.entity.js';
import { TypeOrmCheckpointRepository } from '../harness/checkpoint/persistence/typeorm-checkpoint.repository.js';
import { RunEntity } from '../harness/run/persistence/run.entity.js';
import { TypeOrmRunRepository } from '../harness/run/persistence/typeorm-run.repository.js';
import { HarnessRun } from '../harness/run/run.contract.js';
import { RunVersionConflictError } from '../harness/run/run.errors.js';
import { HarnessRunState } from '../harness/run/run-state.enum.js';
import { RunStep } from '../harness/run/run-step.enum.js';
import { ToolCallEntity } from '../harness/tool-broker/persistence/tool-call.entity.js';
import { TypeOrmToolCallRepository } from '../harness/tool-broker/persistence/typeorm-tool-call.repository.js';
import { ToolCallStatus } from '../harness/tool-broker/tool-call-status.enum.js';
import { ToolCall } from '../harness/tool-broker/tool.contract.js';
import { RuntimeStoreService } from './runtime-store.service.js';
import { createTypeOrmOptions } from './typeorm.config.js';

const channelId = asChannelId('channel-vietnam-discovery');
const correlationId = asCorrelationId('correlation-1');

const createRun = (id = 'run-1'): HarnessRun => ({
  id: asRunId(id),
  channel_id: channelId,
  state: HarnessRunState.RUNNING_STEP,
  current_step: RunStep.TOPIC_RESEARCH,
  retry_count: 0,
  max_retries: 2,
  schema_version: RUN_SCHEMA_VERSION,
  version: 1,
  created_at: '2026-09-23T00:00:00.000Z',
  updated_at: '2026-09-23T00:00:00.000Z',
});

const createCheckpoint = (
  id: string,
  runId: RunId,
  createdAt: string,
): Checkpoint => ({
  id: asCheckpointId(id),
  run_id: runId,
  step: RunStep.TOPIC_RESEARCH,
  run_state: HarnessRunState.RUNNING_STEP,
  artifact_refs: [asArtifactId(`artifact-${id}`)],
  correlation_id: correlationId,
  created_at: createdAt,
  schema_version: CHECKPOINT_SCHEMA_VERSION,
});

const createAuditEvent = (
  id: string,
  runId: RunId,
  createdAt = '2026-09-23T00:01:00.000Z',
): AuditEvent => ({
  id: asAuditEventId(id),
  run_id: runId,
  channel_id: channelId,
  event_type: AuditEventType.RUN_STATE_CHANGED,
  actor: 'integration-test',
  correlation_id: correlationId,
  metadata: { source: 'integration-test' },
  created_at: createdAt,
  schema_version: AUDIT_EVENT_SCHEMA_VERSION,
});

const createToolCall = (id: string, runId: RunId): ToolCall => ({
  id: asToolCallId(id),
  run_id: runId,
  channel_id: channelId,
  tool_name: 'search_assets',
  status: ToolCallStatus.REQUESTED,
  input: { query: 'Huế' },
  correlation_id: correlationId,
  created_at: '2026-09-23T00:01:00.000Z',
  schema_version: TOOL_CALL_SCHEMA_VERSION,
});

describe('PostgreSQL Harness Runtime Store', () => {
  let dataSource: DataSource;
  let runRepository: TypeOrmRunRepository;
  let checkpointRepository: TypeOrmCheckpointRepository;
  let auditRepository: TypeOrmAuditEventRepository;
  let toolCallRepository: TypeOrmToolCallRepository;
  let runtimeStore: RuntimeStoreService;

  beforeAll(async () => {
    dataSource = new DataSource(createTypeOrmOptions());
    await dataSource.initialize();
    await dataSource.runMigrations();

    runRepository = new TypeOrmRunRepository(
      dataSource.getRepository(RunEntity),
    );
    checkpointRepository = new TypeOrmCheckpointRepository(
      dataSource.getRepository(CheckpointEntity),
    );
    auditRepository = new TypeOrmAuditEventRepository(
      dataSource.getRepository(AuditEventEntity),
    );
    toolCallRepository = new TypeOrmToolCallRepository(
      dataSource.getRepository(ToolCallEntity),
    );
    runtimeStore = new RuntimeStoreService(dataSource);
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "tool_calls", "audit_events", "run_checkpoints", "harness_runs" CASCADE',
    );
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('tạo, đọc, cập nhật Run và phát hiện stale version', async () => {
    const created = await runRepository.create(createRun());
    expect((await runRepository.findById(created.id))?.id).toBe(created.id);

    const updated = await runRepository.save(
      { ...created, state: HarnessRunState.WAITING_GATE },
      1,
    );
    expect(updated.state).toBe(HarnessRunState.WAITING_GATE);
    expect(updated.version).toBe(2);

    await expect(
      runRepository.save({ ...created, state: HarnessRunState.PAUSED }, 1),
    ).rejects.toBeInstanceOf(RunVersionConflictError);
  });

  it('trả về Checkpoint mới nhất của Run', async () => {
    const run = await runRepository.create(createRun());
    await checkpointRepository.append(
      createCheckpoint('checkpoint-1', run.id, '2026-09-23T00:01:00.000Z'),
    );
    await checkpointRepository.append(
      createCheckpoint('checkpoint-2', run.id, '2026-09-23T00:02:00.000Z'),
    );

    const latest = await checkpointRepository.findLatestByRunId(run.id);
    expect(latest?.id).toBe(asCheckpointId('checkpoint-2'));
  });

  it('đọc Audit Event theo đúng thứ tự thời gian', async () => {
    const run = await runRepository.create(createRun());
    await auditRepository.append(
      createAuditEvent('audit-2', run.id, '2026-09-23T00:02:00.000Z'),
    );
    await auditRepository.append(
      createAuditEvent('audit-1', run.id, '2026-09-23T00:01:00.000Z'),
    );

    const events = await auditRepository.findByRunId(run.id);
    expect(events.map((event) => event.id)).toEqual([
      asAuditEventId('audit-1'),
      asAuditEventId('audit-2'),
    ]);
  });

  it('lưu output và error khi cập nhật Tool Call', async () => {
    const run = await runRepository.create(createRun());
    const succeeded = await toolCallRepository.create(
      createToolCall('tool-call-success', run.id),
    );
    const failed = await toolCallRepository.create(
      createToolCall('tool-call-failure', run.id),
    );

    const completedAt = '2026-09-23T00:03:00.000Z';
    const succeededResult = await toolCallRepository.updateStatus(
      succeeded.id,
      {
        status: ToolCallStatus.SUCCEEDED,
        output: { assets: ['asset-1'] },
        completed_at: completedAt,
      },
    );
    const failedResult = await toolCallRepository.updateStatus(failed.id, {
      status: ToolCallStatus.FAILED,
      error: { code: 'TIMEOUT', message: 'Hết thời gian', retryable: true },
      completed_at: completedAt,
    });

    expect(succeededResult.output).toEqual({ assets: ['asset-1'] });
    expect(failedResult.error).toEqual({
      code: 'TIMEOUT',
      message: 'Hết thời gian',
      retryable: true,
    });
    expect(await toolCallRepository.findByRunId(run.id)).toHaveLength(2);
  });

  it('commit Run state và Audit Event trong cùng transaction', async () => {
    const run = await runRepository.create(createRun());
    const saved = await runtimeStore.saveRunWithAudit(
      { ...run, state: HarnessRunState.WAITING_GATE },
      1,
      createAuditEvent('audit-success', run.id),
    );

    expect(saved.state).toBe(HarnessRunState.WAITING_GATE);
    expect(saved.version).toBe(2);
    expect(await auditRepository.findByRunId(run.id)).toHaveLength(1);
  });

  it('rollback Run state khi insert Audit Event thất bại', async () => {
    const run = await runRepository.create(createRun());
    const duplicateAudit = createAuditEvent('audit-duplicate', run.id);
    await auditRepository.append(duplicateAudit);

    await expect(
      runtimeStore.saveRunWithAudit(
        { ...run, state: HarnessRunState.WAITING_GATE },
        1,
        duplicateAudit,
      ),
    ).rejects.toThrow();

    const persisted = await runRepository.findById(run.id);
    expect(persisted?.state).toBe(HarnessRunState.RUNNING_STEP);
    expect(persisted?.version).toBe(1);
  });

  it('không insert Audit Event khi Run version bị conflict', async () => {
    const run = await runRepository.create(createRun());

    await expect(
      runtimeStore.saveRunWithAudit(
        { ...run, state: HarnessRunState.WAITING_GATE },
        0,
        createAuditEvent('audit-conflict', run.id),
      ),
    ).rejects.toBeInstanceOf(RunVersionConflictError);

    expect(await auditRepository.findByRunId(run.id)).toHaveLength(0);
  });
});
