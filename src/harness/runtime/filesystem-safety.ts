import { lstat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { UnsafeWorkspacePathError } from './channel-runtime.errors.js';

const SAFE_IDENTIFIER = /^[a-z0-9](?:[a-z0-9-]{0,126}[a-z0-9])?$/;

export const isSafeIdentifier = (value: string): boolean =>
  SAFE_IDENTIFIER.test(value);

export const assertSafeIdentifier = (value: string): void => {
  if (!isSafeIdentifier(value)) {
    throw new UnsafeWorkspacePathError(value);
  }
};

export const assertPathInside = (
  parentPath: string,
  candidatePath: string,
): void => {
  const relativePath = path.relative(parentPath, candidatePath);
  if (
    relativePath === '' ||
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new UnsafeWorkspacePathError(candidatePath);
  }
};

export const assertRegularFileInside = async (
  workspacePath: string,
  filePath: string,
): Promise<void> => {
  assertPathInside(workspacePath, filePath);
  const fileStats = await lstat(filePath);
  if (fileStats.isSymbolicLink() || !fileStats.isFile()) {
    throw new UnsafeWorkspacePathError(filePath);
  }

  const [canonicalWorkspace, canonicalFile] = await Promise.all([
    realpath(workspacePath),
    realpath(filePath),
  ]);
  assertPathInside(canonicalWorkspace, canonicalFile);
};

export const assertDirectoryInside = async (
  workspacePath: string,
  directoryPath: string,
): Promise<void> => {
  assertPathInside(workspacePath, directoryPath);
  const directoryStats = await lstat(directoryPath);
  if (directoryStats.isSymbolicLink() || !directoryStats.isDirectory()) {
    throw new UnsafeWorkspacePathError(directoryPath);
  }

  const [canonicalWorkspace, canonicalDirectory] = await Promise.all([
    realpath(workspacePath),
    realpath(directoryPath),
  ]);
  assertPathInside(canonicalWorkspace, canonicalDirectory);
};
