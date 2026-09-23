import { ProductionState } from './production-state.enum.js';
import { canTransitionProductionState } from './production-transition.js';

describe('quy tắc chuyển trạng thái production', () => {
  it.each([
    [ProductionState.PRECHECK, ProductionState.TOPIC_RESEARCH],
    [ProductionState.CREATIVE_BRIEF, ProductionState.WAITING_GATE_1],
    [ProductionState.WAITING_GATE_1, ProductionState.TIMELINE_DRAFT],
  ])('cho phép %s -> %s', (from, to) => {
    expect(canTransitionProductionState(from, to)).toBe(true);
  });

  it.each([
    [ProductionState.WAITING_GATE_1, ProductionState.COMPLETED],
    [ProductionState.COMPLETED, ProductionState.PRECHECK],
  ])('từ chối %s -> %s', (from, to) => {
    expect(canTransitionProductionState(from, to)).toBe(false);
  });
});
