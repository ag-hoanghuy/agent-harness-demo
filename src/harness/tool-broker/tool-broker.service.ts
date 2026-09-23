import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { asAuditEventId, asToolCallId } from '../../contracts/ids.js';
import {
  AUDIT_EVENT_SCHEMA_VERSION,
  TOOL_CALL_SCHEMA_VERSION,
} from '../../contracts/schema-version.js';
import { RuntimeStoreService } from '../../database/runtime-store.service.js';
import type { AgentTask } from '../../agent/contracts/agent.contract.js';
import type { AuditEvent } from '../audit/audit-event.contract.js';
import { AuditEventType } from '../audit/audit-event-type.enum.js';
import type { HarnessRun } from '../run/run.contract.js';
import { HarnessRunState } from '../run/run-state.enum.js';
import type { ChannelContext } from '../runtime/contracts/channel-context.contract.js';
import {
  ToolExecutionError,
  ToolNotRegisteredError,
  ToolRunStateError,
  ToolScopeMismatchError,
  ToolTimeoutError,
} from './tool-broker.errors.js';
import { assertToolCallTransition } from './tool-call-transition.js';
import {
  TOOL_CALL_REPOSITORY,
  type ToolCallRepository,
  type ToolCallStatusUpdate,
} from './tool-call.repository.js';
import { ToolCallStatus } from './tool-call-status.enum.js';
import type { ToolCall, ToolCallError } from './tool.contract.js';
import type {
  RegisteredTool,
  ToolExecutionRequest,
  ToolExecutorContext,
} from './tool-executor.interface.js';
import { ToolRegistryService } from './tool-registry.service.js';
import { ToolSchemaValidatorService } from './tool-schema-validator.service.js';

interface SuccessfulExecution {
  readonly succeeded: true;
  readonly output: unknown;
  readonly attempts: number;
}

interface FailedExecution {
  readonly succeeded: false;
  readonly error: ToolCallError;
  readonly attempts: number;
}

type ExecutionOutcome = SuccessfulExecution | FailedExecution;

@Injectable()
export class ToolBrokerService {
  constructor(
    @Inject(TOOL_CALL_REPOSITORY)
    private readonly toolCalls: ToolCallRepository,
    private readonly runtimeStore: RuntimeStoreService,
    private readonly registry: ToolRegistryService,
    private readonly schemas: ToolSchemaValidatorService,
  ) {}

  async execute(
    run: HarnessRun,
    agentTask: AgentTask,
    channelContext: ChannelContext,
    request: ToolExecutionRequest,
  ): Promise<ToolCall> {
    this.assertTrustedScope(run, agentTask, channelContext);
    this.assertRunnableState(run);

    const existing = await this.toolCalls.findByInvocation(
      run.id,
      request.toolName,
      request.correlationId,
    );
    if (existing !== null) {
      return existing;
    }

    const requested = await this.createRequestedToolCall(run, request);
    if (requested.status !== ToolCallStatus.REQUESTED) {
      return requested;
    }

    let registeredTool: RegisteredTool;
    try {
      registeredTool = this.registry.resolve(request.toolName);
    } catch (error) {
      if (error instanceof ToolNotRegisteredError) {
        return this.deny(
          requested,
          run,
          request,
          'TOOL_NOT_REGISTERED',
          'Tool chưa được đăng ký trong Tool Registry',
        );
      }
      throw error;
    }

    if (
      !agentTask.allowed_tools.includes(request.toolName) ||
      !channelContext.effectiveAllowedTools.includes(request.toolName)
    ) {
      return this.deny(
        requested,
        run,
        request,
        'TOOL_NOT_ALLOWED',
        'Tool không đồng thời nằm trong task và context allowlist',
        registeredTool.definition.side_effect,
      );
    }

    const inputValidation = this.schemas.validate(
      registeredTool.definition.input_schema,
      request.input,
    );
    if (!inputValidation.valid) {
      return this.deny(
        requested,
        run,
        request,
        'INVALID_TOOL_INPUT',
        `Input không khớp schema: ${inputValidation.errors.join(', ')}`,
        registeredTool.definition.side_effect,
      );
    }

    const allowed = await this.transitionWithAudit(
      requested,
      ToolCallStatus.ALLOWED,
      run,
      request,
      AuditEventType.TOOL_ALLOWED,
      { side_effect: registeredTool.definition.side_effect },
    );
    const running = await this.transition(allowed, ToolCallStatus.RUNNING);
    const outcome = await this.executeWithRetry(
      registeredTool,
      request.input,
      this.createExecutorContext(running),
    );

    if (!outcome.succeeded) {
      return this.completeFailed(
        running,
        run,
        request,
        registeredTool,
        outcome.error,
        outcome.attempts,
      );
    }

    const outputValidation = this.schemas.validate(
      registeredTool.definition.output_schema,
      outcome.output,
    );
    if (!outputValidation.valid) {
      return this.completeFailed(
        running,
        run,
        request,
        registeredTool,
        {
          code: 'INVALID_TOOL_OUTPUT',
          message: `Output không khớp schema: ${outputValidation.errors.join(', ')}`,
          retryable: false,
        },
        outcome.attempts,
      );
    }

    return this.transitionWithAudit(
      running,
      ToolCallStatus.SUCCEEDED,
      run,
      request,
      AuditEventType.TOOL_COMPLETED,
      {
        final_status: ToolCallStatus.SUCCEEDED,
        attempts: outcome.attempts,
        side_effect: registeredTool.definition.side_effect,
      },
      { output: outcome.output },
    );
  }

  private assertTrustedScope(
    run: HarnessRun,
    agentTask: AgentTask,
    channelContext: ChannelContext,
  ): void {
    if (run.id !== agentTask.run_id) {
      throw new ToolScopeMismatchError('run.id khác agentTask.run_id');
    }
    if (run.channel_id !== agentTask.channel_id) {
      throw new ToolScopeMismatchError(
        'run.channel_id khác agentTask.channel_id',
      );
    }
    if (run.channel_id !== channelContext.channel.channelId) {
      throw new ToolScopeMismatchError(
        'run.channel_id khác ChannelContext.channel.channelId',
      );
    }
  }

  private assertRunnableState(run: HarnessRun): void {
    if (run.state !== HarnessRunState.RUNNING_STEP) {
      throw new ToolRunStateError(run.id, run.state);
    }
  }

  private async createRequestedToolCall(
    run: HarnessRun,
    request: ToolExecutionRequest,
  ): Promise<ToolCall> {
    const timestamp = new Date().toISOString();
    const toolCall: ToolCall = {
      id: asToolCallId(randomUUID()),
      run_id: run.id,
      channel_id: run.channel_id,
      tool_name: request.toolName,
      status: ToolCallStatus.REQUESTED,
      input: request.input,
      correlation_id: request.correlationId,
      created_at: timestamp,
      schema_version: TOOL_CALL_SCHEMA_VERSION,
    };
    const audit = this.createAuditEvent(
      toolCall,
      run,
      request,
      AuditEventType.TOOL_REQUESTED,
      {},
      timestamp,
    );

    try {
      return await this.runtimeStore.createToolCallWithAudit(toolCall, audit);
    } catch (error) {
      const existing = await this.toolCalls.findByInvocation(
        run.id,
        request.toolName,
        request.correlationId,
      );
      if (existing !== null) {
        return existing;
      }
      throw error;
    }
  }

  private async deny(
    toolCall: ToolCall,
    run: HarnessRun,
    request: ToolExecutionRequest,
    code: string,
    message: string,
    sideEffect?: boolean,
  ): Promise<ToolCall> {
    return this.transitionWithAudit(
      toolCall,
      ToolCallStatus.DENIED,
      run,
      request,
      AuditEventType.TOOL_DENIED,
      { error_code: code, side_effect: sideEffect },
      { error: { code, message, retryable: false } },
    );
  }

  private async completeFailed(
    toolCall: ToolCall,
    run: HarnessRun,
    request: ToolExecutionRequest,
    registeredTool: RegisteredTool,
    error: ToolCallError,
    attempts: number,
  ): Promise<ToolCall> {
    return this.transitionWithAudit(
      toolCall,
      ToolCallStatus.FAILED,
      run,
      request,
      AuditEventType.TOOL_COMPLETED,
      {
        final_status: ToolCallStatus.FAILED,
        error_code: error.code,
        attempts,
        side_effect: registeredTool.definition.side_effect,
      },
      { error },
    );
  }

  private async transition(
    toolCall: ToolCall,
    status: ToolCallStatus,
    details: Pick<ToolCallStatusUpdate, 'output' | 'error'> = {},
  ): Promise<ToolCall> {
    assertToolCallTransition(toolCall.status, status);
    const update: ToolCallStatusUpdate = {
      status,
      ...details,
      ...(this.isTerminal(status)
        ? { completed_at: new Date().toISOString() }
        : {}),
    };
    return this.runtimeStore.updateToolCall(toolCall.id, update);
  }

  private async transitionWithAudit(
    toolCall: ToolCall,
    status: ToolCallStatus,
    run: HarnessRun,
    request: ToolExecutionRequest,
    eventType: AuditEventType,
    metadata: Readonly<Record<string, unknown>>,
    details: Pick<ToolCallStatusUpdate, 'output' | 'error'> = {},
  ): Promise<ToolCall> {
    assertToolCallTransition(toolCall.status, status);
    const timestamp = new Date().toISOString();
    const update: ToolCallStatusUpdate = {
      status,
      ...details,
      ...(this.isTerminal(status) ? { completed_at: timestamp } : {}),
    };
    const audit = this.createAuditEvent(
      toolCall,
      run,
      request,
      eventType,
      metadata,
      timestamp,
    );
    return this.runtimeStore.updateToolCallWithAudit(
      toolCall.id,
      update,
      audit,
    );
  }

  private async executeWithRetry(
    registeredTool: RegisteredTool,
    input: unknown,
    context: ToolExecutorContext,
  ): Promise<ExecutionOutcome> {
    const { definition, executor } = registeredTool;
    let attempts = 0;

    while (true) {
      attempts += 1;
      try {
        const output = await this.executeWithTimeout(
          definition.name,
          definition.timeout_ms,
          executor.execute.bind(executor),
          input,
          context,
        );
        return { succeeded: true, output, attempts };
      } catch (error) {
        const normalized = this.normalizeExecutionError(error);
        const retriesUsed = attempts - 1;
        const canRetry =
          definition.idempotent &&
          normalized.retryable === true &&
          retriesUsed < definition.max_retries;
        if (canRetry) {
          continue;
        }
        return { succeeded: false, error: normalized, attempts };
      }
    }
  }

  private async executeWithTimeout(
    toolName: string,
    timeoutMs: number,
    execute: (
      input: unknown,
      context: ToolExecutorContext,
      signal?: AbortSignal,
    ) => Promise<unknown>,
    input: unknown,
    context: ToolExecutorContext,
  ): Promise<unknown> {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const timeoutResult = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new ToolTimeoutError(toolName, timeoutMs));
      }, timeoutMs);
    });

    try {
      const execution = Promise.resolve().then(() =>
        execute(input, context, controller.signal),
      );
      return await Promise.race([execution, timeoutResult]);
    } finally {
      if (timeout !== undefined) {
        clearTimeout(timeout);
      }
    }
  }

  private normalizeExecutionError(error: unknown): ToolCallError {
    if (error instanceof ToolExecutionError) {
      return {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
      };
    }
    return {
      code: 'TOOL_EXECUTION_FAILED',
      message: 'Tool executor thất bại',
      retryable: false,
    };
  }

  private createExecutorContext(toolCall: ToolCall): ToolExecutorContext {
    return Object.freeze({
      toolCallId: toolCall.id,
      runId: toolCall.run_id,
      channelId: toolCall.channel_id,
      correlationId: toolCall.correlation_id,
    });
  }

  private createAuditEvent(
    toolCall: ToolCall,
    run: HarnessRun,
    request: ToolExecutionRequest,
    eventType: AuditEventType,
    metadata: Readonly<Record<string, unknown>>,
    timestamp: string,
  ): AuditEvent {
    return {
      id: asAuditEventId(randomUUID()),
      run_id: run.id,
      episode_id: run.episode_id,
      channel_id: run.channel_id,
      event_type: eventType,
      actor: request.actor,
      correlation_id: request.correlationId,
      metadata: {
        tool_name: toolCall.tool_name,
        tool_call_id: toolCall.id,
        ...metadata,
      },
      created_at: timestamp,
      schema_version: AUDIT_EVENT_SCHEMA_VERSION,
    };
  }

  private isTerminal(status: ToolCallStatus): boolean {
    return [
      ToolCallStatus.DENIED,
      ToolCallStatus.SUCCEEDED,
      ToolCallStatus.FAILED,
    ].includes(status);
  }
}
