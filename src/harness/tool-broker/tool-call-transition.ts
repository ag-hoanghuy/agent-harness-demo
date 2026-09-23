import { InvalidToolCallTransitionError } from './tool-call.errors.js';
import { ToolCallStatus } from './tool-call-status.enum.js';

export const TOOL_CALL_TRANSITIONS: Readonly<
  Record<ToolCallStatus, readonly ToolCallStatus[]>
> = Object.freeze({
  [ToolCallStatus.REQUESTED]: Object.freeze([
    ToolCallStatus.ALLOWED,
    ToolCallStatus.DENIED,
  ]),
  [ToolCallStatus.ALLOWED]: Object.freeze([ToolCallStatus.RUNNING]),
  [ToolCallStatus.DENIED]: Object.freeze([]),
  [ToolCallStatus.RUNNING]: Object.freeze([
    ToolCallStatus.SUCCEEDED,
    ToolCallStatus.FAILED,
  ]),
  [ToolCallStatus.SUCCEEDED]: Object.freeze([]),
  [ToolCallStatus.FAILED]: Object.freeze([]),
});

export const canTransitionToolCall = (
  from: ToolCallStatus,
  to: ToolCallStatus,
): boolean => TOOL_CALL_TRANSITIONS[from].includes(to);

export const assertToolCallTransition = (
  from: ToolCallStatus,
  to: ToolCallStatus,
): void => {
  if (!canTransitionToolCall(from, to)) {
    throw new InvalidToolCallTransitionError(from, to);
  }
};
