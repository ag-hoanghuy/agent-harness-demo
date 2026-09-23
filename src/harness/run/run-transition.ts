import { HarnessRunState } from './run-state.enum.js';

export const RUN_TRANSITIONS: Readonly<
  Record<HarnessRunState, readonly HarnessRunState[]>
> = {
  [HarnessRunState.SCHEDULED]: [HarnessRunState.QUEUED],
  [HarnessRunState.QUEUED]: [HarnessRunState.PREFLIGHT],
  [HarnessRunState.PREFLIGHT]: [
    HarnessRunState.RUNNING_STEP,
    HarnessRunState.BLOCKED,
    HarnessRunState.PAUSED,
    HarnessRunState.FAILED_RECOVERABLE,
    HarnessRunState.FAILED_FINAL,
  ],
  [HarnessRunState.RUNNING_STEP]: [
    HarnessRunState.RUNNING_STEP,
    HarnessRunState.WAITING_GATE,
    HarnessRunState.PAUSED,
    HarnessRunState.BLOCKED,
    HarnessRunState.FAILED_RECOVERABLE,
    HarnessRunState.FAILED_FINAL,
    HarnessRunState.AWAITING_MANUAL_PUBLISH,
  ],
  [HarnessRunState.WAITING_GATE]: [
    HarnessRunState.RUNNING_STEP,
    HarnessRunState.NEEDS_REVISION,
    HarnessRunState.PAUSED,
  ],
  [HarnessRunState.NEEDS_REVISION]: [
    HarnessRunState.RUNNING_STEP,
    HarnessRunState.PAUSED,
  ],
  [HarnessRunState.AWAITING_MANUAL_PUBLISH]: [HarnessRunState.MEASURING],
  [HarnessRunState.MEASURING]: [HarnessRunState.COMPLETED],
  [HarnessRunState.COMPLETED]: [],
  [HarnessRunState.PAUSED]: [HarnessRunState.QUEUED],
  [HarnessRunState.BLOCKED]: [HarnessRunState.QUEUED],
  [HarnessRunState.FAILED_RECOVERABLE]: [HarnessRunState.QUEUED],
  [HarnessRunState.FAILED_FINAL]: [],
};

export function canTransitionRun(
  from: HarnessRunState,
  to: HarnessRunState,
): boolean {
  return RUN_TRANSITIONS[from].includes(to);
}

export function assertRunTransition(
  from: HarnessRunState,
  to: HarnessRunState,
): void {
  if (!canTransitionRun(from, to)) {
    throw new Error(
      `Chuyển trạng thái Harness Run không hợp lệ: ${from} -> ${to}`,
    );
  }
}
