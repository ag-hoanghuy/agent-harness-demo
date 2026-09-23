import { Gate } from './gate.contract.js';
import { GateStatus } from './gate.enums.js';

export enum GateInvariantViolation {
  APPROVED_REQUIRES_DECIDED_BY = 'APPROVED_REQUIRES_DECIDED_BY',
  REJECTED_REQUIRES_FEEDBACK = 'REJECTED_REQUIRES_FEEDBACK',
  PENDING_CANNOT_HAVE_DECIDED_AT = 'PENDING_CANNOT_HAVE_DECIDED_AT',
}

export interface GateValidationResult {
  valid: boolean;
  violations: readonly GateInvariantViolation[];
}

const hasText = (value: string | undefined): boolean =>
  value !== undefined && value.trim().length > 0;

export function validateGate(gate: Gate): GateValidationResult {
  const violations: GateInvariantViolation[] = [];

  if (gate.status === GateStatus.APPROVED && !hasText(gate.decided_by)) {
    violations.push(GateInvariantViolation.APPROVED_REQUIRES_DECIDED_BY);
  }

  if (gate.status === GateStatus.REJECTED && !hasText(gate.feedback)) {
    violations.push(GateInvariantViolation.REJECTED_REQUIRES_FEEDBACK);
  }

  if (gate.status === GateStatus.PENDING && gate.decided_at !== undefined) {
    violations.push(GateInvariantViolation.PENDING_CANNOT_HAVE_DECIDED_AT);
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
