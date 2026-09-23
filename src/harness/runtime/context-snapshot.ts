import { ChannelContext } from './contracts/channel-context.contract.js';
import {
  ChannelContextSnapshot,
  ContextDocumentSnapshot,
} from './contracts/context-snapshot.contract.js';
import { LoadedDocument } from './contracts/loaded-document.contract.js';

const snapshotDocuments = (
  documents: readonly LoadedDocument[],
): readonly ContextDocumentSnapshot[] =>
  Object.freeze(
    documents.map((document) =>
      Object.freeze({
        name: document.name,
        relativePath: document.relativePath,
        checksum: document.checksum,
      }),
    ),
  );

export const createContextSnapshot = (
  context: ChannelContext,
): ChannelContextSnapshot =>
  Object.freeze({
    channelId: context.channel.channelId,
    rules: snapshotDocuments(context.rules),
    skills: snapshotDocuments(context.skills),
    memory: snapshotDocuments(context.memory),
    effectiveAllowedTools: Object.freeze([...context.effectiveAllowedTools]),
  });
