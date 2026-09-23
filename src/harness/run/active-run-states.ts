import { HarnessRunState } from './run-state.enum.js';

export const ACTIVE_RUN_STATES: readonly HarnessRunState[] = Object.freeze([
  HarnessRunState.QUEUED,
  HarnessRunState.PREFLIGHT,
  HarnessRunState.RUNNING_STEP,
  HarnessRunState.WAITING_GATE,
  HarnessRunState.NEEDS_REVISION,
  HarnessRunState.AWAITING_MANUAL_PUBLISH,
  HarnessRunState.MEASURING,
]);

const ACTIVE_RUN_STATE_SET = new Set(ACTIVE_RUN_STATES);

export const consumesChannelCapacity = (state: HarnessRunState): boolean =>
  ACTIVE_RUN_STATE_SET.has(state);
