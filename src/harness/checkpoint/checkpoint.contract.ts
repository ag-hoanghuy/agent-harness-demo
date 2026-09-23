import { CHECKPOINT_SCHEMA_VERSION } from '../../contracts/schema-version.js';
import {
  ArtifactId,
  CheckpointId,
  CorrelationId,
  EpisodeId,
  RunId,
} from '../../contracts/ids.js';
import { HarnessRunState } from '../run/run-state.enum.js';
import { RunStep } from '../run/run-step.enum.js';

export interface Checkpoint {
  id: CheckpointId;
  run_id: RunId;
  step: RunStep;
  run_state: HarnessRunState;
  episode_id?: EpisodeId;
  artifact_refs: readonly ArtifactId[];
  correlation_id: CorrelationId;
  created_at: string;
  schema_version: typeof CHECKPOINT_SCHEMA_VERSION;
}
