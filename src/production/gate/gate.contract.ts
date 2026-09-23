import { GATE_SCHEMA_VERSION } from '../../contracts/schema-version.js';
import { ArtifactId, EpisodeId, GateId } from '../../contracts/ids.js';
import { GateStatus, GateType } from './gate.enums.js';

export interface Gate {
  id: GateId;
  episode_id: EpisodeId;
  type: GateType;
  status: GateStatus;
  required_action: string;
  candidate_artifact_ids: readonly ArtifactId[];
  feedback?: string;
  decided_by?: string;
  requested_at: string;
  decided_at?: string;
  version: number;
  schema_version: typeof GATE_SCHEMA_VERSION;
}
