import { RUN_SCHEMA_VERSION } from '../../contracts/schema-version.js';
import { ChannelId, EpisodeId, RunId } from '../../contracts/ids.js';
import { HarnessRunState } from './run-state.enum.js';
import { RunStep } from './run-step.enum.js';

export interface HarnessRun {
  id: RunId;
  channel_id: ChannelId;
  episode_id?: EpisodeId;
  state: HarnessRunState;
  current_step: RunStep | null;
  retry_count: number;
  max_retries: number;
  schema_version: typeof RUN_SCHEMA_VERSION;
  version: number;
  created_at: string;
  updated_at: string;
}
