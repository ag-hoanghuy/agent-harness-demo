import { RunId } from '../../contracts/ids.js';
import { Checkpoint } from './checkpoint.contract.js';

export const CHECKPOINT_REPOSITORY = Symbol('CHECKPOINT_REPOSITORY');

export interface CheckpointRepository {
  append(checkpoint: Checkpoint): Promise<Checkpoint>;
  findLatestByRunId(runId: RunId): Promise<Checkpoint | null>;
}
