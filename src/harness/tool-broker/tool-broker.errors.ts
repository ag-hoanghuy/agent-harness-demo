import type { RunId } from '../../contracts/ids.js';
import type { HarnessRunState } from '../run/run-state.enum.js';

export class ToolScopeMismatchError extends Error {
  constructor(reason: string) {
    super(`Tool request không cùng trusted scope: ${reason}`);
    this.name = 'ToolScopeMismatchError';
  }
}

export class ToolRunStateError extends Error {
  constructor(runId: RunId, actualState: HarnessRunState) {
    super(
      `Run ${runId} không thể execute tool ở state ${actualState}; yêu cầu RUNNING_STEP`,
    );
    this.name = 'ToolRunStateError';
  }
}

export class ToolNotRegisteredError extends Error {
  constructor(toolName: string) {
    super(`Tool chưa được đăng ký: ${toolName}`);
    this.name = 'ToolNotRegisteredError';
  }
}

export class DuplicateToolRegistrationError extends Error {
  constructor(toolName: string) {
    super(`Tool đã được đăng ký: ${toolName}`);
    this.name = 'DuplicateToolRegistrationError';
  }
}

export class InvalidToolDefinitionError extends Error {
  constructor(toolName: string, reason: string, options?: ErrorOptions) {
    super(`ToolDefinition ${toolName} không hợp lệ: ${reason}`, options);
    this.name = 'InvalidToolDefinitionError';
  }
}

export class ToolExecutionError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable = false,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ToolExecutionError';
  }
}

export class ToolTimeoutError extends ToolExecutionError {
  constructor(toolName: string, timeoutMs: number) {
    super('TOOL_TIMEOUT', `Tool ${toolName} vượt timeout ${timeoutMs}ms`, true);
    this.name = 'ToolTimeoutError';
  }
}
