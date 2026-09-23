import { InvalidToolCallTransitionError } from './tool-call.errors.js';
import { ToolCallStatus } from './tool-call-status.enum.js';
import {
  assertToolCallTransition,
  canTransitionToolCall,
} from './tool-call-transition.js';

describe('ToolCall transition', () => {
  it('cho phép lifecycle thành công chuẩn', () => {
    expect(
      canTransitionToolCall(ToolCallStatus.REQUESTED, ToolCallStatus.ALLOWED),
    ).toBe(true);
    expect(
      canTransitionToolCall(ToolCallStatus.ALLOWED, ToolCallStatus.RUNNING),
    ).toBe(true);
    expect(
      canTransitionToolCall(ToolCallStatus.RUNNING, ToolCallStatus.SUCCEEDED),
    ).toBe(true);
  });

  it('cho phép REQUESTED → DENIED', () => {
    expect(
      canTransitionToolCall(ToolCallStatus.REQUESTED, ToolCallStatus.DENIED),
    ).toBe(true);
  });

  it.each([
    ToolCallStatus.DENIED,
    ToolCallStatus.SUCCEEDED,
    ToolCallStatus.FAILED,
  ])('coi %s là terminal', (status) => {
    expect(canTransitionToolCall(status, ToolCallStatus.RUNNING)).toBe(false);
    expect(() =>
      assertToolCallTransition(status, ToolCallStatus.RUNNING),
    ).toThrow(InvalidToolCallTransitionError);
  });
});
