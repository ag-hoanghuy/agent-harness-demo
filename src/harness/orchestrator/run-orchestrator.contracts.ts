import { ChannelId, CorrelationId, RunId } from '../../contracts/ids.js';

export interface CreateRunCommand {
  readonly channelId: ChannelId;
  readonly correlationId: CorrelationId;
  readonly actor: string;
}

export interface RunLifecycleCommand {
  readonly runId: RunId;
  readonly expectedVersion: number;
  readonly correlationId: CorrelationId;
  readonly actor: string;
}
