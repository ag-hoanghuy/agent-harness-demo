import { consumesChannelCapacity } from './active-run-states.js';
import { HarnessRunState } from './run-state.enum.js';

describe('capacity state của Harness Run', () => {
  it.each([
    HarnessRunState.QUEUED,
    HarnessRunState.PREFLIGHT,
    HarnessRunState.RUNNING_STEP,
    HarnessRunState.WAITING_GATE,
    HarnessRunState.NEEDS_REVISION,
    HarnessRunState.AWAITING_MANUAL_PUBLISH,
    HarnessRunState.MEASURING,
  ])('%s chiếm capacity của channel', (state) => {
    expect(consumesChannelCapacity(state)).toBe(true);
  });

  it.each([
    HarnessRunState.SCHEDULED,
    HarnessRunState.BLOCKED,
    HarnessRunState.PAUSED,
    HarnessRunState.FAILED_RECOVERABLE,
    HarnessRunState.FAILED_FINAL,
    HarnessRunState.COMPLETED,
  ])('%s không chiếm capacity của channel', (state) => {
    expect(consumesChannelCapacity(state)).toBe(false);
  });
});
