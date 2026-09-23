import {
  asArtifactId,
  asCheckpointId,
  asCorrelationId,
  asEpisodeId,
  asRunId,
} from '../../../contracts/ids.js';
import { CHECKPOINT_SCHEMA_VERSION } from '../../../contracts/schema-version.js';
import { Checkpoint } from '../checkpoint.contract.js';
import { CheckpointEntity } from './checkpoint.entity.js';

export class CheckpointMapper {
  static toEntity(checkpoint: Checkpoint): CheckpointEntity {
    const entity = new CheckpointEntity();
    entity.id = checkpoint.id;
    entity.run_id = checkpoint.run_id;
    entity.step = checkpoint.step;
    entity.run_state = checkpoint.run_state;
    entity.episode_id = checkpoint.episode_id ?? null;
    entity.artifact_refs = [...checkpoint.artifact_refs];
    entity.correlation_id = checkpoint.correlation_id;
    entity.schema_version = checkpoint.schema_version;
    entity.created_at = new Date(checkpoint.created_at);
    return entity;
  }

  static toDomain(entity: CheckpointEntity): Checkpoint {
    return {
      id: asCheckpointId(entity.id),
      run_id: asRunId(entity.run_id),
      step: entity.step,
      run_state: entity.run_state,
      episode_id:
        entity.episode_id === null ? undefined : asEpisodeId(entity.episode_id),
      artifact_refs: entity.artifact_refs.map(asArtifactId),
      correlation_id: asCorrelationId(entity.correlation_id),
      schema_version: entity.schema_version as typeof CHECKPOINT_SCHEMA_VERSION,
      created_at: entity.created_at.toISOString(),
    };
  }
}
