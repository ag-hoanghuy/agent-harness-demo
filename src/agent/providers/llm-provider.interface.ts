import type { AgentResult, AgentTask } from '../contracts/agent.contract.js';
import type { AgentExecutionContext } from './agent-provider.types.js';

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface LlmProvider {
  readonly name: string;

  execute(
    task: AgentTask,
    context: AgentExecutionContext,
  ): Promise<AgentResult>;
}
