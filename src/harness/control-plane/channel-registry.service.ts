import { Inject, Injectable } from '@nestjs/common';
import { lstat, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import {
  ChannelConfigNotFoundError,
  ChannelNotFoundError,
  UnsafeWorkspacePathError,
} from '../runtime/channel-runtime.errors.js';
import {
  assertPathInside,
  assertSafeIdentifier,
} from '../runtime/filesystem-safety.js';

export const CHANNELS_ROOT = Symbol('CHANNELS_ROOT');

export interface ChannelWorkspace {
  readonly channelId: string;
  readonly workspacePath: string;
  readonly harnessPath: string;
  readonly configPath: string;
}

const isMissingPath = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

@Injectable()
export class ChannelRegistryService {
  private readonly channelsRoot: string;

  constructor(@Inject(CHANNELS_ROOT) channelsRoot: string) {
    this.channelsRoot = path.resolve(channelsRoot);
  }

  async getChannelWorkspace(channelId: string): Promise<ChannelWorkspace> {
    assertSafeIdentifier(channelId);

    const workspacePath = path.resolve(this.channelsRoot, channelId);
    const harnessPath = path.join(workspacePath, '.harness');
    const configPath = path.join(harnessPath, 'channel.yaml');
    assertPathInside(this.channelsRoot, workspacePath);

    try {
      const [rootStats, workspaceStats] = await Promise.all([
        lstat(this.channelsRoot),
        lstat(workspacePath),
      ]);
      if (
        rootStats.isSymbolicLink() ||
        !rootStats.isDirectory() ||
        workspaceStats.isSymbolicLink() ||
        !workspaceStats.isDirectory()
      ) {
        throw new UnsafeWorkspacePathError(workspacePath);
      }
    } catch (error) {
      if (isMissingPath(error)) {
        throw new ChannelNotFoundError(channelId);
      }
      throw error;
    }

    try {
      const [harnessStats, configStats] = await Promise.all([
        lstat(harnessPath),
        lstat(configPath),
      ]);
      if (
        harnessStats.isSymbolicLink() ||
        !harnessStats.isDirectory() ||
        configStats.isSymbolicLink() ||
        !configStats.isFile()
      ) {
        throw new UnsafeWorkspacePathError(configPath);
      }
    } catch (error) {
      if (isMissingPath(error)) {
        throw new ChannelConfigNotFoundError(channelId);
      }
      throw error;
    }

    const [canonicalRoot, canonicalWorkspace, canonicalConfig] =
      await Promise.all([
        realpath(this.channelsRoot),
        realpath(workspacePath),
        realpath(configPath),
      ]);
    assertPathInside(canonicalRoot, canonicalWorkspace);
    assertPathInside(canonicalWorkspace, canonicalConfig);

    return Object.freeze({
      channelId,
      workspacePath,
      harnessPath,
      configPath,
    });
  }

  async listChannels(): Promise<readonly string[]> {
    let entries;
    try {
      const rootStats = await lstat(this.channelsRoot);
      if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
        throw new UnsafeWorkspacePathError(this.channelsRoot);
      }
      entries = await readdir(this.channelsRoot, { withFileTypes: true });
    } catch (error) {
      if (isMissingPath(error)) {
        return Object.freeze([]);
      }
      throw error;
    }

    const channelIds: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      try {
        assertSafeIdentifier(entry.name);
        await this.getChannelWorkspace(entry.name);
        channelIds.push(entry.name);
      } catch (error) {
        if (
          error instanceof ChannelConfigNotFoundError ||
          error instanceof ChannelNotFoundError
        ) {
          continue;
        }
        throw error;
      }
    }

    return Object.freeze(channelIds.sort());
  }
}
