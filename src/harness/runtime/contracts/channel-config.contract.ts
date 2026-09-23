import { ChannelId } from '../../../contracts/ids.js';

export interface ChannelConfig {
  readonly channelId: ChannelId;
  readonly enabled: boolean;
  readonly timezone: string;
  readonly concurrency: Readonly<{
    maxActiveRuns: number;
  }>;
  readonly autonomy: Readonly<{
    level: string;
  }>;
  readonly requiredGates: readonly string[];
  readonly limits: Readonly<{
    maxRetriesPerStep: number;
  }>;
  readonly allowedTools: readonly string[];
}
