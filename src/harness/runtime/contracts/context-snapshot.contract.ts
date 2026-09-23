import { ChannelId } from '../../../contracts/ids.js';

export interface ContextDocumentSnapshot {
  readonly name: string;
  readonly relativePath: string;
  readonly checksum: string;
}

export interface ChannelContextSnapshot {
  readonly channelId: ChannelId;
  readonly rules: readonly ContextDocumentSnapshot[];
  readonly skills: readonly ContextDocumentSnapshot[];
  readonly memory: readonly ContextDocumentSnapshot[];
  readonly effectiveAllowedTools: readonly string[];
}
