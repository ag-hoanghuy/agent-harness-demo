import { ChannelId, RunId } from '../../contracts/ids.js';
import { HarnessRun } from './run.contract.js';

export const RUN_REPOSITORY = Symbol('RUN_REPOSITORY');

export interface RunRepository {
  create(run: HarnessRun): Promise<HarnessRun>;
  findById(id: RunId): Promise<HarnessRun | null>;
  save(run: HarnessRun, expectedVersion: number): Promise<HarnessRun>;
  findActiveByChannel(channelId: ChannelId): Promise<readonly HarnessRun[]>;
}
