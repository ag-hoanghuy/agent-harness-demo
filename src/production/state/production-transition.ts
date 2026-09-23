import { ProductionState } from './production-state.enum.js';

export const PRODUCTION_TRANSITIONS: Readonly<
  Record<ProductionState, readonly ProductionState[]>
> = {
  [ProductionState.PRECHECK]: [ProductionState.TOPIC_RESEARCH],
  [ProductionState.TOPIC_RESEARCH]: [ProductionState.CREATIVE_BRIEF],
  [ProductionState.CREATIVE_BRIEF]: [ProductionState.WAITING_GATE_1],
  [ProductionState.WAITING_GATE_1]: [
    ProductionState.TIMELINE_DRAFT,
    ProductionState.REVISION_REQUIRED,
  ],
  [ProductionState.TIMELINE_DRAFT]: [ProductionState.RENDER_DRAFT],
  [ProductionState.RENDER_DRAFT]: [ProductionState.THUMBNAIL],
  [ProductionState.THUMBNAIL]: [ProductionState.WAITING_GATE_2],
  [ProductionState.WAITING_GATE_2]: [
    ProductionState.PUBLISH_PACKAGE,
    ProductionState.REVISION_REQUIRED,
    ProductionState.TIMELINE_DRAFT,
  ],
  [ProductionState.PUBLISH_PACKAGE]: [ProductionState.WAITING_GATE_3],
  [ProductionState.WAITING_GATE_3]: [
    ProductionState.AWAITING_MANUAL_PUBLISH,
    ProductionState.REVISION_REQUIRED,
    ProductionState.TIMELINE_DRAFT,
  ],
  [ProductionState.AWAITING_MANUAL_PUBLISH]: [ProductionState.MEASUREMENT],
  [ProductionState.MEASUREMENT]: [ProductionState.COMPLETED],
  [ProductionState.COMPLETED]: [],
  [ProductionState.REVISION_REQUIRED]: [
    ProductionState.CREATIVE_BRIEF,
    ProductionState.TIMELINE_DRAFT,
    ProductionState.THUMBNAIL,
    ProductionState.PUBLISH_PACKAGE,
  ],
};

export function canTransitionProductionState(
  from: ProductionState,
  to: ProductionState,
): boolean {
  return PRODUCTION_TRANSITIONS[from].includes(to);
}
