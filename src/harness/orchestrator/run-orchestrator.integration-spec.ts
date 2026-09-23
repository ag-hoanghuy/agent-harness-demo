import { DataSource } from 'typeorm';
import path from 'node:path';
import {
  asAuditEventId,
  asChannelId,
  asCheckpointId,
  asCorrelationId,
  asRunId,
} from '../../contracts/ids.js';
import {
  AUDIT_EVENT_SCHEMA_VERSION,
  CHECKPOINT_SCHEMA_VERSION,
  RUN_SCHEMA_VERSION,
} from '../../contracts/schema-version.js';
import { createTypeOrmOptions } from '../../database/typeorm.config.js';
import { RuntimeStoreService } from '../../database/runtime-store.service.js';
import { AuditEvent } from '../audit/audit-event.contract.js';
import { AuditEventType } from '../audit/audit-event-type.enum.js';
import { AuditEventEntity } from '../audit/persistence/audit-event.entity.js';
import { TypeOrmAuditEventRepository } from '../audit/persistence/typeorm-audit-event.repository.js';
import { Checkpoint } from '../checkpoint/checkpoint.contract.js';
import { CheckpointEntity } from '../checkpoint/persistence/checkpoint.entity.js';
import { TypeOrmCheckpointRepository } from '../checkpoint/persistence/typeorm-checkpoint.repository.js';
import { ChannelRegistryService } from '../control-plane/channel-registry.service.js';
import { RunPolicyService } from '../control-plane/run-policy.service.js';
import { RunEntity } from '../run/persistence/run.entity.js';
import { TypeOrmRunRepository } from '../run/persistence/typeorm-run.repository.js';
import { HarnessRun } from '../run/run.contract.js';
import { HarnessRunState } from '../run/run-state.enum.js';
import { RunStep } from '../run/run-step.enum.js';
import { ContextLoaderService } from '../runtime/context-loader.service.js';
import { createContextSnapshot } from '../runtime/context-snapshot.js';
import { SkillLoaderService } from '../runtime/skill-loader.service.js';
import { HarnessRunOrchestrator } from './run-orchestrator.service.js';
import { RuntimeIdFactory } from './runtime-id.factory.js';

const channelId = asChannelId('channel-vietnam-discovery');

describe('Harness Run Orchestrator với PostgreSQL', () => {
  let dataSource: DataSource;
  let runRepository: TypeOrmRunRepository;
  let checkpointRepository: TypeOrmCheckpointRepository;
  let auditRepository: TypeOrmAuditEventRepository;
  let runtimeStore: RuntimeStoreService;
  let contextLoader: ContextLoaderService;
  let orchestrator: HarnessRunOrchestrator;

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
    runtimeStore = new RuntimeStoreService(dataSource);
    const registry = new ChannelRegistryService(
      path.resolve(process.cwd(), 'channels'),
    );
    contextLoader = new ContextLoaderService(
      registry,
      new SkillLoaderService(registry),
    );
    orchestrator = new HarnessRunOrchestrator(
      runRepository,
      runtimeStore,
      contextLoader,
      new RunPolicyService(),
      new RuntimeIdFactory(),
    );
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

  it('reload được Run, checkpoint và audit sau create → queue → preflight', async () => {
    const correlationId = asCorrelationId('restart-style-correlation');
    const created = await orchestrator.createRun({
      channelId,
      correlationId,
      actor: 'integration-operator',
    });
    const queued = await orchestrator.queueRun({
      runId: created.id,
      expectedVersion: created.version,
      correlationId,
      actor: 'integration-operator',
    });
    const ready = await orchestrator.preflightRun({
      runId: queued.id,
      expectedVersion: queued.version,
      correlationId,
      actor: 'integration-operator',
    });

    const reloaded = await runRepository.findById(ready.id);
    const checkpoint = await checkpointRepository.findLatestByRunId(ready.id);
    const audits = await auditRepository.findByRunId(ready.id);

    expect(reloaded?.state).toBe(HarnessRunState.RUNNING_STEP);
    expect(reloaded?.current_step).toBe(RunStep.TOPIC_RESEARCH);
    expect(reloaded?.version).toBe(4);
    expect(checkpoint?.step).toBe(RunStep.PRECHECK);
    expect(checkpoint?.context_snapshot?.channelId).toBe(channelId);
    expect(
      checkpoint?.context_snapshot?.skills.map(({ name }) => name),
    ).toEqual(['topic-research']);
    expect(audits).toHaveLength(6);
    expect(audits.map(({ event_type }) => event_type)).toEqual(
      expect.arrayContaining([
        AuditEventType.RUN_CREATED,
        AuditEventType.STEP_STARTED,
        AuditEventType.STEP_COMPLETED,
      ]),
    );
    expect(
      audits.every((event) => event.correlation_id === correlationId),
    ).toBe(true);
  });

  it('rollback checkpoint và Run update khi audit cuối transaction thất bại', async () => {
    const correlationId = asCorrelationId('rollback-correlation');
    const timestamp = '2026-09-23T00:00:00.000Z';
    const run: HarnessRun = {
      id: asRunId('run-atomic-rollback'),
      channel_id: channelId,
      state: HarnessRunState.PREFLIGHT,
      current_step: RunStep.PRECHECK,
      retry_count: 0,
      max_retries: 2,
      schema_version: RUN_SCHEMA_VERSION,
      version: 1,
      created_at: timestamp,
      updated_at: timestamp,
    };
    await runRepository.create(run);

    const duplicateAudit: AuditEvent = {
      id: asAuditEventId('audit-duplicate-final'),
      run_id: run.id,
      channel_id: channelId,
      event_type: AuditEventType.RUN_STATE_CHANGED,
      actor: 'integration-test',
      correlation_id: correlationId,
      metadata: {},
      created_at: timestamp,
      schema_version: AUDIT_EVENT_SCHEMA_VERSION,
    };
    await auditRepository.append(duplicateAudit);

    const context = await contextLoader.loadChannelContext(channelId, {
      skills: ['topic-research'],
    });
    const checkpoint: Checkpoint = {
      id: asCheckpointId('checkpoint-should-rollback'),
      run_id: run.id,
      step: RunStep.PRECHECK,
      run_state: HarnessRunState.RUNNING_STEP,
      artifact_refs: [],
      context_snapshot: createContextSnapshot(context),
      correlation_id: correlationId,
      created_at: timestamp,
      schema_version: CHECKPOINT_SCHEMA_VERSION,
    };

    await expect(
      runtimeStore.saveRunWithCheckpointAndAudits(
        {
          ...run,
          state: HarnessRunState.RUNNING_STEP,
          current_step: RunStep.TOPIC_RESEARCH,
        },
        1,
        checkpoint,
        [duplicateAudit],
      ),
    ).rejects.toThrow();

    const reloaded = await runRepository.findById(run.id);
    expect(reloaded?.state).toBe(HarnessRunState.PREFLIGHT);
    expect(reloaded?.version).toBe(1);
    expect(await checkpointRepository.findLatestByRunId(run.id)).toBeNull();
    expect(await auditRepository.findByRunId(run.id)).toHaveLength(1);
  });
});
