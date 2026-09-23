import path from 'node:path';
import { DataSource } from 'typeorm';
import {
  asAgentTaskId,
  asChannelId,
  asCorrelationId,
} from '../contracts/ids.js';
import { AGENT_TASK_SCHEMA_VERSION } from '../contracts/schema-version.js';
import type { AgentTask } from '../agent/contracts/agent.contract.js';
import { AgentTaskType } from '../agent/contracts/agent.enums.js';
import { RuntimeStoreService } from '../database/runtime-store.service.js';
import { createTypeOrmOptions } from '../database/typeorm.config.js';
import { AuditEventType } from '../harness/audit/audit-event-type.enum.js';
import { AuditEventEntity } from '../harness/audit/persistence/audit-event.entity.js';
import { TypeOrmAuditEventRepository } from '../harness/audit/persistence/typeorm-audit-event.repository.js';
import { ChannelRegistryService } from '../harness/control-plane/channel-registry.service.js';
import { RunPolicyService } from '../harness/control-plane/run-policy.service.js';
import { HarnessRunOrchestrator } from '../harness/orchestrator/run-orchestrator.service.js';
import { RuntimeIdFactory } from '../harness/orchestrator/runtime-id.factory.js';
import { RunEntity } from '../harness/run/persistence/run.entity.js';
import { TypeOrmRunRepository } from '../harness/run/persistence/typeorm-run.repository.js';
import type { HarnessRun } from '../harness/run/run.contract.js';
import { HarnessRunState } from '../harness/run/run-state.enum.js';
import { RunStep } from '../harness/run/run-step.enum.js';
import { ContextLoaderService } from '../harness/runtime/context-loader.service.js';
import type { ChannelContext } from '../harness/runtime/contracts/channel-context.contract.js';
import { SkillLoaderService } from '../harness/runtime/skill-loader.service.js';
import { ToolCallEntity } from '../harness/tool-broker/persistence/tool-call.entity.js';
import { TypeOrmToolCallRepository } from '../harness/tool-broker/persistence/typeorm-tool-call.repository.js';
import { ToolBrokerService } from '../harness/tool-broker/tool-broker.service.js';
import { ToolCallStatus } from '../harness/tool-broker/tool-call-status.enum.js';
import { ToolRegistryService } from '../harness/tool-broker/tool-registry.service.js';
import { ToolSchemaValidatorService } from '../harness/tool-broker/tool-schema-validator.service.js';
import {
  LOCAL_MCP_TOOL_DEFINITIONS,
  LOCAL_MCP_TOOL_NAMES,
} from './local/local-tool-definitions.js';
import { McpClientService } from './mcp-client.service.js';
import type { McpClientPort } from './mcp-client.types.js';
import { McpTransportError } from './mcp.errors.js';
import { createLocalMcpServerLaunch } from './mcp-launch.config.js';
import { McpToolExecutor } from './mcp-tool-executor.js';
import { McpToolRegistrationService } from './mcp-tool-registration.service.js';

const channelId = asChannelId('channel-vietnam-discovery');

describe('Local MCP qua Tool Broker và PostgreSQL', () => {
  let dataSource: DataSource;
  let runRepository: TypeOrmRunRepository;
  let toolCallRepository: TypeOrmToolCallRepository;
  let auditRepository: TypeOrmAuditEventRepository;
  let runtimeStore: RuntimeStoreService;
  let contextLoader: ContextLoaderService;
  let orchestrator: HarnessRunOrchestrator;
  let mcpClient: McpClientService;
  let registry: ToolRegistryService;
  let broker: ToolBrokerService;

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

    mcpClient = new McpClientService(createLocalMcpServerLaunch());
    const schemas = new ToolSchemaValidatorService();
    registry = new ToolRegistryService(schemas);
    new McpToolRegistrationService(registry, mcpClient).onModuleInit();
    broker = new ToolBrokerService(
      toolCallRepository,
      runtimeStore,
      registry,
      schemas,
    );
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "tool_calls", "audit_events", "run_checkpoints", "harness_runs" CASCADE',
    );
  });

  afterAll(async () => {
    await mcpClient?.close();
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  const createReadyRun = async (label: string): Promise<HarnessRun> => {
    const correlationId = asCorrelationId(`mcp-run-${label}`);
    const created = await orchestrator.createRun({
      channelId,
      correlationId,
      actor: 'mcp-integration-operator',
    });
    const queued = await orchestrator.queueRun({
      runId: created.id,
      expectedVersion: created.version,
      correlationId,
      actor: 'mcp-integration-operator',
    });
    return orchestrator.preflightRun({
      runId: queued.id,
      expectedVersion: queued.version,
      correlationId,
      actor: 'mcp-integration-operator',
    });
  };

  const createTask = (
    run: HarnessRun,
    allowedTools: readonly string[],
  ): AgentTask => ({
    task_id: asAgentTaskId(`mcp-task-${run.id}`),
    run_id: run.id,
    episode_id: run.episode_id,
    channel_id: run.channel_id,
    task_type: AgentTaskType.TOPIC_RESEARCH,
    allowed_tools: allowedTools,
    context_refs: ['skill:topic-research'],
    schema_version: AGENT_TASK_SCHEMA_VERSION,
  });

  const loadTopicResearchContext = (): Promise<ChannelContext> =>
    contextLoader.loadChannelContext(channelId, {
      skills: ['topic-research'],
    });

  it('handshake stdio và advertise đúng ba local tools', async () => {
    const tools = await mcpClient.listTools();

    expect(tools.map(({ name }) => name)).toEqual([
      LOCAL_MCP_TOOL_NAMES.SEARCH_ASSETS,
      LOCAL_MCP_TOOL_NAMES.GET_ASSET_METADATA,
      LOCAL_MCP_TOOL_NAMES.GET_RECENT_ANALYTICS,
    ]);
  });

  it('Broker gọi search_assets qua MCP, persist output/audit và giữ nguyên Run', async () => {
    const ready = await createReadyRun('search');
    const context = await loadTopicResearchContext();
    const invocationId = asCorrelationId('mcp-search-invocation');

    const result = await broker.execute(
      ready,
      createTask(ready, context.effectiveAllowedTools),
      context,
      {
        toolName: LOCAL_MCP_TOOL_NAMES.SEARCH_ASSETS,
        input: { query: 'floating market', limit: 1 },
        actor: 'mcp-integration-agent',
        correlationId: invocationId,
      },
    );

    const persisted = await toolCallRepository.findByInvocation(
      ready.id,
      LOCAL_MCP_TOOL_NAMES.SEARCH_ASSETS,
      invocationId,
    );
    const audits = (await auditRepository.findByRunId(ready.id)).filter(
      ({ correlation_id }) => correlation_id === invocationId,
    );
    const reloadedRun = await runRepository.findById(ready.id);

    expect(result.status).toBe(ToolCallStatus.SUCCEEDED);
    expect(persisted).toMatchObject({
      run_id: ready.id,
      channel_id: channelId,
      tool_name: LOCAL_MCP_TOOL_NAMES.SEARCH_ASSETS,
      status: ToolCallStatus.SUCCEEDED,
    });
    expect(persisted?.output).toMatchObject({
      assets: [{ id: 'asset-001', media_type: 'video' }],
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

  it('Broker nhận analytics structured từ Local MCP server', async () => {
    const ready = await createReadyRun('analytics');
    const context = await loadTopicResearchContext();

    const result = await broker.execute(
      ready,
      createTask(ready, context.effectiveAllowedTools),
      context,
      {
        toolName: LOCAL_MCP_TOOL_NAMES.GET_RECENT_ANALYTICS,
        input: { channel_id: channelId, days: 7 },
        actor: 'mcp-integration-agent',
        correlationId: asCorrelationId('mcp-analytics-invocation'),
      },
    );

    expect(result.status).toBe(ToolCallStatus.SUCCEEDED);
    expect(result.output).toMatchObject({
      channel_id: channelId,
      period_days: 7,
      metrics: { views: 125_000, average_watch_seconds: 31 },
      top_topics: [
        { topic: 'Vietnam street food', score: 0.91 },
        { topic: 'Mekong Delta', score: 0.84 },
      ],
    });
  });

  it('DENIED get_asset_metadata trước MCP khi AgentTask không cho phép', async () => {
    const ready = await createReadyRun('denied');
    const context = await loadTopicResearchContext();
    const callTool = vi.spyOn(mcpClient, 'callTool');

    try {
      const result = await broker.execute(
        ready,
        createTask(ready, context.effectiveAllowedTools),
        context,
        {
          toolName: LOCAL_MCP_TOOL_NAMES.GET_ASSET_METADATA,
          input: { asset_id: 'asset-001' },
          actor: 'mcp-integration-agent',
          correlationId: asCorrelationId('mcp-denied-invocation'),
        },
      );

      expect(result.status).toBe(ToolCallStatus.DENIED);
      expect(result.error?.code).toBe('TOOL_NOT_ALLOWED');
      expect(callTool).not.toHaveBeenCalled();
    } finally {
      callTool.mockRestore();
    }
  });

  it('map MCP tool failure thành FAILED và không đổi Run', async () => {
    const ready = await createReadyRun('failure');
    const baseContext = await loadTopicResearchContext();
    const allowedTools = Object.freeze([
      ...baseContext.effectiveAllowedTools,
      LOCAL_MCP_TOOL_NAMES.GET_ASSET_METADATA,
    ]);
    const context: ChannelContext = Object.freeze({
      ...baseContext,
      effectiveAllowedTools: allowedTools,
    });
    const invocationId = asCorrelationId('mcp-failure-invocation');

    const result = await broker.execute(
      ready,
      createTask(ready, allowedTools),
      context,
      {
        toolName: LOCAL_MCP_TOOL_NAMES.GET_ASSET_METADATA,
        input: { asset_id: 'asset-missing' },
        actor: 'mcp-integration-agent',
        correlationId: invocationId,
      },
    );
    const audits = (await auditRepository.findByRunId(ready.id)).filter(
      ({ correlation_id }) => correlation_id === invocationId,
    );
    const reloadedRun = await runRepository.findById(ready.id);

    expect(result.status).toBe(ToolCallStatus.FAILED);
    expect(result.error?.code).toBe('MCP_TOOL_ERROR');
    expect(audits.at(-1)).toMatchObject({
      event_type: AuditEventType.TOOL_COMPLETED,
      metadata: { final_status: ToolCallStatus.FAILED },
    });
    expect(reloadedRun?.state).toBe(HarnessRunState.RUNNING_STEP);
    expect(reloadedRun?.current_step).toBe(RunStep.TOPIC_RESEARCH);
    expect(reloadedRun?.version).toBe(ready.version);
  });

  it('Broker sở hữu retry khi MCP transport lỗi lần đầu rồi success', async () => {
    const ready = await createReadyRun('retry');
    const context = await loadTopicResearchContext();
    let attempts = 0;
    const callTool = vi.fn(async (toolName, input, signal) => {
      attempts += 1;
      if (attempts === 1) {
        throw new McpTransportError('Lỗi transport mô phỏng lần đầu');
      }
      return mcpClient.callTool(toolName, input, signal);
    });
    const flakyClient: McpClientPort = {
      callTool,
    };
    const schemas = new ToolSchemaValidatorService();
    const retryRegistry = new ToolRegistryService(schemas);
    retryRegistry.register({
      definition:
        LOCAL_MCP_TOOL_DEFINITIONS[LOCAL_MCP_TOOL_NAMES.SEARCH_ASSETS],
      executor: new McpToolExecutor(
        flakyClient,
        LOCAL_MCP_TOOL_NAMES.SEARCH_ASSETS,
      ),
    });
    const retryBroker = new ToolBrokerService(
      toolCallRepository,
      runtimeStore,
      retryRegistry,
      schemas,
    );

    const result = await retryBroker.execute(
      ready,
      createTask(ready, context.effectiveAllowedTools),
      context,
      {
        toolName: LOCAL_MCP_TOOL_NAMES.SEARCH_ASSETS,
        input: { query: 'floating market', limit: 1 },
        actor: 'mcp-integration-agent',
        correlationId: asCorrelationId('mcp-retry-invocation'),
      },
    );

    expect(result.status).toBe(ToolCallStatus.SUCCEEDED);
    expect(callTool).toHaveBeenCalledTimes(2);
    expect(attempts).toBe(2);
  });
});
