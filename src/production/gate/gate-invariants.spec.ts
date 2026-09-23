import { asArtifactId, asEpisodeId, asGateId } from '../../contracts/ids.js';
import { GATE_SCHEMA_VERSION } from '../../contracts/schema-version.js';
import { Gate } from './gate.contract.js';
import { GateStatus, GateType } from './gate.enums.js';
import { GateInvariantViolation, validateGate } from './gate-invariants.js';

const createGate = (overrides: Partial<Gate> = {}): Gate => ({
  id: asGateId('gate-1'),
  episode_id: asEpisodeId('episode-1'),
  type: GateType.CREATIVE_BRIEF,
  status: GateStatus.PENDING,
  required_action: 'Xem xét creative brief',
  candidate_artifact_ids: [asArtifactId('artifact-1')],
  requested_at: '2026-09-23T00:00:00.000Z',
  version: 1,
  schema_version: GATE_SCHEMA_VERSION,
  ...overrides,
});

describe('invariant của Gate', () => {
  it('từ chối APPROVED khi không có decided_by', () => {
    const result = validateGate(createGate({ status: GateStatus.APPROVED }));

    expect(result.valid).toBe(false);
    expect(result.violations).toContain(
      GateInvariantViolation.APPROVED_REQUIRES_DECIDED_BY,
    );
  });

  it('từ chối REJECTED khi feedback trống', () => {
    const result = validateGate(
      createGate({ status: GateStatus.REJECTED, feedback: '   ' }),
    );

    expect(result.valid).toBe(false);
    expect(result.violations).toContain(
      GateInvariantViolation.REJECTED_REQUIRES_FEEDBACK,
    );
  });

  it('chấp nhận PENDING hợp lệ', () => {
    expect(validateGate(createGate())).toEqual({
      valid: true,
      violations: [],
    });
  });

  it('từ chối PENDING khi đã có decided_at', () => {
    const result = validateGate(
      createGate({ decided_at: '2026-09-23T01:00:00.000Z' }),
    );

    expect(result.valid).toBe(false);
    expect(result.violations).toContain(
      GateInvariantViolation.PENDING_CANNOT_HAVE_DECIDED_AT,
    );
  });

  it('chấp nhận APPROVED hợp lệ', () => {
    const result = validateGate(
      createGate({
        status: GateStatus.APPROVED,
        decided_by: 'operator-1',
        decided_at: '2026-09-23T01:00:00.000Z',
      }),
    );

    expect(result).toEqual({ valid: true, violations: [] });
  });
});
