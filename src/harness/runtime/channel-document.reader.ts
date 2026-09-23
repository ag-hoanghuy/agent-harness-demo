import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { ChannelWorkspace } from '../control-plane/channel-registry.service.js';
import { LoadedDocument } from './contracts/loaded-document.contract.js';
import {
  assertDirectoryInside,
  assertRegularFileInside,
} from './filesystem-safety.js';

interface LoadMarkdownDirectoryOptions {
  readonly fileNames?: ReadonlySet<string>;
}

const isMissingPath = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

const toPortableRelativePath = (
  workspacePath: string,
  filePath: string,
): string => path.relative(workspacePath, filePath).split(path.sep).join('/');

export const readMarkdownDocument = async (
  workspace: ChannelWorkspace,
  filePath: string,
): Promise<LoadedDocument> => {
  await assertRegularFileInside(workspace.workspacePath, filePath);
  const bytes = await readFile(filePath);

  return Object.freeze({
    name: path.basename(filePath, '.md'),
    relativePath: toPortableRelativePath(workspace.workspacePath, filePath),
    content: bytes.toString('utf8'),
    checksum: createHash('sha256').update(bytes).digest('hex'),
  });
};

export const loadMarkdownDirectory = async (
  workspace: ChannelWorkspace,
  directoryName: 'rules' | 'memory',
  options: LoadMarkdownDirectoryOptions = {},
): Promise<readonly LoadedDocument[]> => {
  const directoryPath = path.join(workspace.harnessPath, directoryName);
  try {
    await assertDirectoryInside(workspace.workspacePath, directoryPath);
  } catch (error) {
    if (isMissingPath(error)) {
      return Object.freeze([]);
    }
    throw error;
  }

  const entries = await readdir(directoryPath, { withFileTypes: true });
  const markdownFiles = entries
    .filter(
      (entry) =>
        entry.name.endsWith('.md') &&
        (options.fileNames === undefined || options.fileNames.has(entry.name)),
    )
    .sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );

  const documents: LoadedDocument[] = [];
  for (const entry of markdownFiles) {
    const filePath = path.join(directoryPath, entry.name);
    documents.push(await readMarkdownDocument(workspace, filePath));
  }
  return Object.freeze(documents);
};
