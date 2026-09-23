import path from 'node:path';
import { DataSource } from 'typeorm';
import { asChannelId, asCorrelationId } from '../contracts/ids.js';
import { createTypeOrmOptions } from '../database/typeorm.config.js';
import { RuntimeStoreService } from '../database/runtime-store.service.js';
import { ChannelRegistryService } from '../harness/control-plane/channel-registry.service.js';
import { RunPolicyService } from '../harness/control-plane/run-policy.service.js';
import { HarnessRunOrchestrator } from '../harness/orchestrator/run-orchestrator.service.js';
import { RuntimeIdFactory } from '../harness/orchestrator/runtime-id.factory.js';
import { RunEntity } from '../harness/run/persistence/run.entity.js';
import { TypeOrmRunRepository } from '../harness/run/persistence/typeorm-run.repository.js';
import { HarnessRunState } from '../harness/run/run-state.enum.js';
import { RunStep } from '../harness/run/run-step.enum.js';
import { ContextLoaderService } from '../harness/runtime/context-loader.service.js';
import { SkillLoaderService } from '../harness/runtime/skill-loader.service.js';
import { AgentRuntimeService } from './agent-runtime.service.js';
import { AgentResultStatus, AgentTaskType } from './contracts/agent.enums.js';
import { FakeProvider } from './providers/fake.provider.js';

const channelId = asChannelId('channel-vietnam-discovery');

describe('Agent Runtime với PostgreSQL Harness Run', () => {
  let dataSource: DataSource;
  let runRepository: TypeOrmRunRepository;
  let contextLoader: ContextLoaderService;
  let orchestrator: HarnessRunOrchestrator;
  let agentRuntime: AgentRuntimeService;

  beforeAll(async () => {
    dataSource = new DataSource(createTypeOrmOptions());
    await dataSource.initialize();
    await dataSource.runMigrations();

    runRepository = new TypeOrmRunRepository(
      dataSource.getRepository(RunEntity),
    );
    const runtimeStore = new RuntimeStoreService(dataSource);
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
    agentRuntime = new AgentRuntimeService(new FakeProvider());
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

  it('trả AgentResult nhưng không thay đổi RUNNING_STEP / TOPIC_RESEARCH', async () => {
    const correlationId = asCorrelationId('agent-runtime-integration');
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
    const reloadedBeforeAgent = await runRepository.findById(ready.id);
    const context = await contextLoader.loadChannelContext(channelId, {
      skills: ['topic-research'],
    });

    const result = await agentRuntime.execute(
      reloadedBeforeAgent!,
      context,
      AgentTaskType.TOPIC_RESEARCH,
      correlationId,
    );
    const reloadedAfterAgent = await runRepository.findById(ready.id);

    expect(result.status).toBe(AgentResultStatus.SUCCESS);
    expect(reloadedAfterAgent?.state).toBe(HarnessRunState.RUNNING_STEP);
    expect(reloadedAfterAgent?.current_step).toBe(RunStep.TOPIC_RESEARCH);
    expect(reloadedAfterAgent?.version).toBe(ready.version);
  });
});
