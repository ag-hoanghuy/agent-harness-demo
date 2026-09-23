import {
  asAgentTaskId,
  asChannelId,
  asCorrelationId,
  asRunId,
} from '../../contracts/ids.js';
import {
  AGENT_RESULT_SCHEMA_VERSION,
  AGENT_TASK_SCHEMA_VERSION,
} from '../../contracts/schema-version.js';
import type { AgentTask } from '../contracts/agent.contract.js';
import { AgentResultStatus, AgentTaskType } from '../contracts/agent.enums.js';
import type { AgentExecutionContext } from './agent-provider.types.js';
import { FakeProvider } from './fake.provider.js';

const task: AgentTask = {
  task_id: asAgentTaskId('task-topic-research'),
  run_id: asRunId('run-topic-research'),
  channel_id: asChannelId('channel-vietnam-discovery'),
  task_type: AgentTaskType.TOPIC_RESEARCH,
  allowed_tools: ['search_assets', 'get_recent_analytics'],
  context_refs: [
    'channel-rule:editorial',
    'skill:topic-research',
    'memory:approved-knowledge',
  ],
  schema_version: AGENT_TASK_SCHEMA_VERSION,
};

const context: AgentExecutionContext = {
  channelId: task.channel_id,
  runId: task.run_id,
  taskType: task.task_type,
  channelRules: [
    { name: 'editorial', content: '# Quy tắc biên tập' },
    { name: 'footage', content: '# Quy tắc footage' },
  ],
  selectedSkills: [{ name: 'topic-research', content: '# Nghiên cứu chủ đề' }],
  approvedMemory: [
    { name: 'approved-knowledge', content: '# Tri thức đã duyệt' },
  ],
  effectiveAllowedTools: ['search_assets', 'get_recent_analytics'],
  correlationId: asCorrelationId('correlation-fake-provider'),
};

describe('FakeProvider', () => {
  const provider = new FakeProvider();

  it('trả TOPIC_RESEARCH SUCCESS có cấu trúc và giữ nguyên task_id', async () => {
    const result = await provider.execute(task, context);

    expect(provider.name).toBe('fake');
    expect(result.task_id).toBe(task.task_id);
    expect(result.status).toBe(AgentResultStatus.SUCCESS);
    expect(result.schema_version).toBe(AGENT_RESULT_SCHEMA_VERSION);
    expect(result.result).toEqual({
      topic: 'Chợ nổi Cái Răng lúc bình minh',
      summary:
        'Dữ liệu mô phỏng đề xuất một góc tiếp cận về nhịp sống và văn hóa giao thương buổi sớm trên sông Cần Thơ.',
      candidate_asset_queries: [
        'can-tho river morning',
        'floating market vietnam',
      ],
    });
    expect(result.evidence_refs).toEqual([
      'mock:channel-rule:editorial',
      'mock:approved-memory',
    ]);
    expect(result.warnings).toEqual([]);
  });

  it('trả output deterministic khi input giống nhau', async () => {
    const first = await provider.execute(task, context);
    const second = await provider.execute(task, context);

    expect(second).toEqual(first);
  });

  it('không tạo tool call dù task có allowed_tools', async () => {
    const result = await provider.execute(task, context);

    expect(task.allowed_tools).not.toHaveLength(0);
    expect(result).not.toHaveProperty('tool_call');
    expect(result.result).not.toHaveProperty('tool_call');
  });

  it('không mutate AgentTask hoặc AgentExecutionContext', async () => {
    const taskBefore = structuredClone(task);
    const contextBefore = structuredClone(context);

    await provider.execute(task, context);

    expect(task).toEqual(taskBefore);
    expect(context).toEqual(contextBefore);
  });
});
