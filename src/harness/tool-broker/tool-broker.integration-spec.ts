import path from 'node:path';
import { DataSource } from 'typeorm';
import {
  asAgentTaskId,
  asAuditEventId,
  asChannelId,
  asCorrelationId,
  asToolCallId,
} from '../../contracts/ids.js';
import {
  AGENT_TASK_SCHEMA_VERSION,
  AUDIT_EVENT_SCHEMA_VERSION,
  TOOL_CALL_SCHEMA_VERSION,
  TOOL_DEFINITION_SCHEMA_VERSION,
} from '../../contracts/schema-version.js';
import type { AgentTask } from '../../agent/contracts/agent.contract.js';
import { AgentTaskType } from '../../agent/contracts/agent.enums.js';
import { createTypeOrmOptions } from '../../database/typeorm.config.js';
import { RuntimeStoreService } from '../../database/runtime-store.service.js';
import type { AuditEvent } from '../audit/audit-event.contract.js';
import { AuditEventType } from '../audit/audit-event-type.enum.js';
import { AuditEventEntity } from '../audit/persistence/audit-event.entity.js';
import { TypeOrmAuditEventRepository } from '../audit/persistence/typeorm-audit-event.repository.js';
import { ChannelRegistryService } from '../control-plane/channel-registry.service.js';
import { RunPolicyService } from '../control-plane/run-policy.service.js';
import { HarnessRunOrchestrator } from '../orchestrator/run-orchestrator.service.js';
import { RuntimeIdFactory } from '../orchestrator/runtime-id.factory.js';
import { RunEntity } from '../run/persistence/run.entity.js';
import { TypeOrmRunRepository } from '../run/persistence/typeorm-run.repository.js';
import type { HarnessRun } from '../run/run.contract.js';
import { HarnessRunState } from '../run/run-state.enum.js';
import { RunStep } from '../run/run-step.enum.js';
import { ContextLoaderService } from '../runtime/context-loader.service.js';
import type { ChannelContext } from '../runtime/contracts/channel-context.contract.js';
import { SkillLoaderService } from '../runtime/skill-loader.service.js';
import { ToolBrokerService } from './tool-broker.service.js';
import { ToolCallEntity } from './persistence/tool-call.entity.js';
import { TypeOrmToolCallRepository } from './persistence/typeorm-tool-call.repository.js';
import { ToolCallStatus } from './tool-call-status.enum.js';
import type { ToolCall, ToolDefinition } from './tool.contract.js';
import type { ToolExecutor } from './tool-executor.interface.js';
import { ToolRegistryService } from './tool-registry.service.js';
import { ToolSchemaValidatorService } from './tool-schema-validator.service.js';

const channelId = asChannelId('channel-vietnam-discovery');

const createDefinition = (name = 'search_assets'): ToolDefinition => ({
  name,
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
    properties: {
      assets: { type: 'array' },
    },
  },
  timeout_ms: 1_000,
  max_retries: 1,
  idempotent: true,
  side_effect: false,
});

describe('Tool Broker với PostgreSQL', () => {
  let dataSource: DataSource;
  let runRepository: TypeOrmRunRepository;
  let toolCallRepository: TypeOrmToolCallRepository;
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
    toolCallRepository = new TypeOrmToolCallRepository(
      dataSource.getRepository(ToolCallEntity),
    );
    auditRepository = new TypeOrmAuditEventRepository(
      dataSource.getRepository(AuditEventEntity),
    );
    runtimeStore = new RuntimeStoreService(dataSource);
    const channelRegistry = new ChannelRegistryService(
      path.resolve(process.cwd(), 'channels'),
    );
    contextLoader = new ContextLoaderService(
      channelRegistry,
      new SkillLoaderService(channelRegistry),
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

  const createReadyRun = async (label: string): Promise<HarnessRun> => {
    const correlationId = asCorrelationId(`run-lifecycle-${label}`);
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
    return orchestrator.preflightRun({
      runId: queued.id,
      expectedVersion: queued.version,
      correlationId,
      actor: 'integration-operator',
    });
  };

  const createTask = (run: HarnessRun, context: ChannelContext): AgentTask => ({
    task_id: asAgentTaskId(`task-${run.id}`),
    run_id: run.id,
    episode_id: run.episode_id,
    channel_id: run.channel_id,
    task_type: AgentTaskType.TOPIC_RESEARCH,
    allowed_tools: context.effectiveAllowedTools,
    context_refs: ['skill:topic-research'],
    schema_version: AGENT_TASK_SCHEMA_VERSION,
  });

  const createBroker = (
    definition: ToolDefinition,
    executor: ToolExecutor,
  ): ToolBrokerService => {
    const schemas = new ToolSchemaValidatorService();
    const registry = new ToolRegistryService(schemas);
    registry.register({ definition, executor });
    return new ToolBrokerService(
      toolCallRepository,
      runtimeStore,
      registry,
      schemas,
    );
  };

  it('authorize, execute, persist và audit tool mà không đổi Run', async () => {
    const ready = await createReadyRun('success');
    const context = await contextLoader.loadChannelContext(channelId, {
      skills: ['topic-research'],
    });
    const invocationId = asCorrelationId('tool-invocation-success');
    const execute = vi.fn().mockResolvedValue({
      assets: [{ id: 'asset-001', title: 'Mock floating market footage' }],
    });
    const broker = createBroker(createDefinition(), { execute });

    const result = await broker.execute(
      ready,
      createTask(ready, context),
      context,
      {
        toolName: 'search_assets',
        input: { query: 'floating market' },
        actor: 'integration-agent-runtime',
        correlationId: invocationId,
      },
    );
    const repeated = await broker.execute(
      ready,
      createTask(ready, context),
      context,
      {
        toolName: 'search_assets',
        input: { query: 'floating market' },
        actor: 'integration-agent-runtime',
        correlationId: invocationId,
      },
    );

    const persisted = await toolCallRepository.findByInvocation(
      ready.id,
      'search_assets',
      invocationId,
    );
    const audits = (await auditRepository.findByRunId(ready.id)).filter(
      (event) => event.correlation_id === invocationId,
    );
    const reloadedRun = await runRepository.findById(ready.id);

    expect(result.status).toBe(ToolCallStatus.SUCCEEDED);
    expect(repeated.id).toBe(result.id);
    expect(execute).toHaveBeenCalledOnce();
    expect(persisted?.run_id).toBe(ready.id);
    expect(persisted?.channel_id).toBe(channelId);
    expect(persisted?.tool_name).toBe('search_assets');
    expect(persisted?.output).toEqual({
      assets: [{ id: 'asset-001', title: 'Mock floating market footage' }],
    });
    expect(audits.map(({ event_type }) => event_type)).toEqual([
      AuditEventType.TOOL_REQUESTED,
      AuditEventType.TOOL_ALLOWED,
      AuditEventType.TOOL_COMPLETED,
    ]);
    expect(reloadedRun?.state).toBe(HarnessRunState.RUNNING_STEP);
    expect(reloadedRun?.current_step).toBe(RunStep.TOPIC_RESEARCH);
    expect(reloadedRun?.version).toBe(ready.version);
  });

  it('persist DENIED + audit và không execute tool ngoài effective allowlist', async () => {
    const ready = await createReadyRun('denied');
    const context = await contextLoader.loadChannelContext(channelId, {
      skills: ['topic-research'],
    });
    const invocationId = asCorrelationId('tool-invocation-denied');
    const execute = vi.fn().mockResolvedValue({ assets: [] });
    const broker = createBroker(createDefinition('get_asset_metadata'), {
      execute,
    });

    const result = await broker.execute(
      ready,
      createTask(ready, context),
      context,
      {
        toolName: 'get_asset_metadata',
        input: { query: 'asset-001' },
        actor: 'integration-agent-runtime',
        correlationId: invocationId,
      },
    );

    const persisted = await toolCallRepository.findByInvocation(
      ready.id,
      'get_asset_metadata',
      invocationId,
    );
    const audits = (await auditRepository.findByRunId(ready.id)).filter(
      (event) => event.correlation_id === invocationId,
    );
    const reloadedRun = await runRepository.findById(ready.id);

    expect(result.status).toBe(ToolCallStatus.DENIED);
    expect(persisted?.status).toBe(ToolCallStatus.DENIED);
    expect(audits.map(({ event_type }) => event_type)).toEqual([
      AuditEventType.TOOL_REQUESTED,
      AuditEventType.TOOL_DENIED,
    ]);
    expect(execute).not.toHaveBeenCalled();
    expect(reloadedRun?.state).toBe(HarnessRunState.RUNNING_STEP);
    expect(reloadedRun?.current_step).toBe(RunStep.TOPIC_RESEARCH);
    expect(reloadedRun?.version).toBe(ready.version);
  });

  it('rollback ToolCall status khi TOOL_COMPLETED audit insert thất bại', async () => {
    const ready = await createReadyRun('rollback');
    const invocationId = asCorrelationId('tool-invocation-rollback');
    const timestamp = '2026-09-23T00:00:00.000Z';
    const toolCall: ToolCall = {
      id: asToolCallId('tool-call-rollback'),
      run_id: ready.id,
      channel_id: ready.channel_id,
      tool_name: 'search_assets',
      status: ToolCallStatus.RUNNING,
      input: { query: 'floating market' },
      correlation_id: invocationId,
      created_at: timestamp,
      schema_version: TOOL_CALL_SCHEMA_VERSION,
    };
    await toolCallRepository.create(toolCall);

    const duplicateAudit: AuditEvent = {
      id: asAuditEventId('duplicate-tool-completed-audit'),
      run_id: ready.id,
      channel_id: ready.channel_id,
      event_type: AuditEventType.TOOL_COMPLETED,
      actor: 'integration-test',
      correlation_id: invocationId,
      metadata: {
        tool_name: toolCall.tool_name,
        tool_call_id: toolCall.id,
        final_status: ToolCallStatus.SUCCEEDED,
      },
      created_at: timestamp,
      schema_version: AUDIT_EVENT_SCHEMA_VERSION,
    };
    await auditRepository.append(duplicateAudit);

    await expect(
      runtimeStore.updateToolCallWithAudit(
        toolCall.id,
        {
          status: ToolCallStatus.SUCCEEDED,
          output: { assets: [] },
          completed_at: timestamp,
        },
        duplicateAudit,
      ),
    ).rejects.toThrow();

    const persisted = await toolCallRepository.findById(toolCall.id);
    expect(persisted?.status).toBe(ToolCallStatus.RUNNING);
    expect(persisted?.output).toBeUndefined();
    expect(persisted?.completed_at).toBeUndefined();
  });
});
