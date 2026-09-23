import { HarnessRunState } from './run-state.enum.js';
import { assertRunTransition, canTransitionRun } from './run-transition.js';

describe('quy tắc chuyển trạng thái Harness Run', () => {
  it.each([
    [HarnessRunState.SCHEDULED, HarnessRunState.QUEUED],
    [HarnessRunState.QUEUED, HarnessRunState.PREFLIGHT],
    [HarnessRunState.WAITING_GATE, HarnessRunState.RUNNING_STEP],
    [HarnessRunState.WAITING_GATE, HarnessRunState.NEEDS_REVISION],
  ])('cho phép %s -> %s', (from, to) => {
    expect(canTransitionRun(from, to)).toBe(true);
  });

  it.each([
    [HarnessRunState.COMPLETED, HarnessRunState.RUNNING_STEP],
    [HarnessRunState.FAILED_FINAL, HarnessRunState.QUEUED],
  ])('từ chối %s -> %s', (from, to) => {
    expect(canTransitionRun(from, to)).toBe(false);
  });

  it('ném lỗi khi assert một transition không hợp lệ', () => {
    expect(() =>
      assertRunTransition(
        HarnessRunState.COMPLETED,
        HarnessRunState.RUNNING_STEP,
      ),
    ).toThrowError('COMPLETED -> RUNNING_STEP');
  });
});
