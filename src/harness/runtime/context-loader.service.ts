import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { ChannelRegistryService } from '../control-plane/channel-registry.service.js';
import { parseChannelConfig } from './channel-config.parser.js';
import { loadMarkdownDirectory } from './channel-document.reader.js';
import { ChannelConfigMismatchError } from './channel-runtime.errors.js';
import {
  ChannelContext,
  LoadChannelContextOptions,
} from './contracts/channel-context.contract.js';
import { ChannelConfig } from './contracts/channel-config.contract.js';
import { assertRegularFileInside } from './filesystem-safety.js';
import { SkillLoaderService } from './skill-loader.service.js';

const APPROVED_MEMORY_FILES = new Set(['approved-knowledge.md']);

@Injectable()
export class ContextLoaderService {
  constructor(
    private readonly channelRegistry: ChannelRegistryService,
    private readonly skillLoader: SkillLoaderService,
  ) {}

  async loadChannelConfig(channelId: string): Promise<ChannelConfig> {
    const workspace = await this.channelRegistry.getChannelWorkspace(channelId);
    return this.readChannelConfig(workspace, channelId);
  }

  async loadChannelContext(
    channelId: string,
    options: LoadChannelContextOptions = {},
  ): Promise<ChannelContext> {
    const workspace = await this.channelRegistry.getChannelWorkspace(channelId);
    const channel = await this.readChannelConfig(workspace, channelId);

    const [rules, memory, skills] = await Promise.all([
      loadMarkdownDirectory(workspace, 'rules'),
      loadMarkdownDirectory(workspace, 'memory', {
        fileNames: APPROVED_MEMORY_FILES,
      }),
      this.skillLoader.loadSkills(channelId, options.skills ?? []),
    ]);

    const skillAllowedTools = new Set(
      skills.flatMap((skill) => skill.allowedTools),
    );
    const effectiveAllowedTools = Object.freeze(
      channel.allowedTools.filter((tool) => skillAllowedTools.has(tool)),
    );

    return Object.freeze({
      channel,
      rules,
      skills,
      memory,
      effectiveAllowedTools,
    });
  }

  private async readChannelConfig(
    workspace: Awaited<
      ReturnType<ChannelRegistryService['getChannelWorkspace']>
    >,
    channelId: string,
  ): Promise<ChannelConfig> {
    await assertRegularFileInside(
      workspace.workspacePath,
      workspace.configPath,
    );
    const channel = parseChannelConfig(
      await readFile(workspace.configPath, 'utf8'),
    );

    if (channel.channelId !== channelId) {
      throw new ChannelConfigMismatchError(channelId, channel.channelId);
    }
    return channel;
  }
}
