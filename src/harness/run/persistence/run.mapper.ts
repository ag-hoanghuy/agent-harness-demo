import { asChannelId, asEpisodeId, asRunId } from '../../../contracts/ids.js';
import { RUN_SCHEMA_VERSION } from '../../../contracts/schema-version.js';
import { HarnessRun } from '../run.contract.js';
import { RunEntity } from './run.entity.js';

export class RunMapper {
  static toEntity(run: HarnessRun): RunEntity {
    const entity = new RunEntity();
    entity.id = run.id;
    entity.channel_id = run.channel_id;
    entity.episode_id = run.episode_id ?? null;
    entity.state = run.state;
    entity.current_step = run.current_step;
    entity.retry_count = run.retry_count;
    entity.max_retries = run.max_retries;
    entity.schema_version = run.schema_version;
    entity.version = run.version;
    entity.created_at = new Date(run.created_at);
    entity.updated_at = new Date(run.updated_at);
    return entity;
  }

  static toDomain(entity: RunEntity): HarnessRun {
    return {
      id: asRunId(entity.id),
      channel_id: asChannelId(entity.channel_id),
      episode_id:
        entity.episode_id === null ? undefined : asEpisodeId(entity.episode_id),
      state: entity.state,
      current_step: entity.current_step,
      retry_count: entity.retry_count,
      max_retries: entity.max_retries,
      schema_version: entity.schema_version as typeof RUN_SCHEMA_VERSION,
      version: entity.version,
      created_at: entity.created_at.toISOString(),
      updated_at: entity.updated_at.toISOString(),
    };
  }
}
