import { Injectable } from '@nestjs/common';
import { AGENT_RESULT_SCHEMA_VERSION } from '../../contracts/schema-version.js';
import type { AgentResult, AgentTask } from '../contracts/agent.contract.js';
import { AgentResultStatus, AgentTaskType } from '../contracts/agent.enums.js';
import type { TopicResearchResult } from '../contracts/topic-research-result.contract.js';
import { UnsupportedAgentTaskError } from '../agent-runtime.errors.js';
import type { AgentExecutionContext } from './agent-provider.types.js';
import type { LlmProvider } from './llm-provider.interface.js';

@Injectable()
export class FakeProvider implements LlmProvider {
  readonly name = 'fake';

  async execute(
    task: AgentTask,
    context: AgentExecutionContext,
  ): Promise<AgentResult> {
    if (task.task_type !== AgentTaskType.TOPIC_RESEARCH) {
      throw new UnsupportedAgentTaskError(task.task_type);
    }

    const result: TopicResearchResult = Object.freeze({
      topic: 'Chợ nổi Cái Răng lúc bình minh',
      summary:
        'Dữ liệu mô phỏng đề xuất một góc tiếp cận về nhịp sống và văn hóa giao thương buổi sớm trên sông Cần Thơ.',
      candidate_asset_queries: Object.freeze([
        'can-tho river morning',
        'floating market vietnam',
      ]),
    });
    const editorialRule = context.channelRules.find(
      (rule) => rule.name === 'editorial',
    );
    const evidenceRefs = Object.freeze([
      ...(editorialRule === undefined
        ? []
        : [`mock:channel-rule:${editorialRule.name}`]),
      ...(context.approvedMemory.length === 0 ? [] : ['mock:approved-memory']),
    ]);

    return Object.freeze({
      task_id: task.task_id,
      status: AgentResultStatus.SUCCESS,
      result,
      evidence_refs: evidenceRefs,
      warnings: Object.freeze([]),
      schema_version: AGENT_RESULT_SCHEMA_VERSION,
    });
  }
}
