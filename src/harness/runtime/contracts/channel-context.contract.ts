import { ChannelConfig } from './channel-config.contract.js';
import { LoadedDocument, LoadedSkill } from './loaded-document.contract.js';

export interface ChannelContext {
  readonly channel: ChannelConfig;
  readonly rules: readonly LoadedDocument[];
  readonly skills: readonly LoadedSkill[];
  readonly memory: readonly LoadedDocument[];
  readonly effectiveAllowedTools: readonly string[];
}

export interface LoadChannelContextOptions {
  readonly skills?: readonly string[];
}
