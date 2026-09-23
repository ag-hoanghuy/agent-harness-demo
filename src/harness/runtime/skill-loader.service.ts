import { Injectable } from '@nestjs/common';
import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { ChannelRegistryService } from '../control-plane/channel-registry.service.js';
import { SkillNotFoundError } from './channel-runtime.errors.js';
import { readMarkdownDocument } from './channel-document.reader.js';
import { LoadedSkill } from './contracts/loaded-document.contract.js';
import {
  assertDirectoryInside,
  assertSafeIdentifier,
} from './filesystem-safety.js';

const ALLOWED_TOOLS_HEADING =
  /^#{2,6}\s+(?:Allowed Tools|Công cụ được phép)\s*$/iu;
const NEXT_HEADING = /^#{1,6}\s+/u;
const TOOL_LIST_ITEM = /^\s*[-*]\s+(?:`([^`]+)`|([a-z][a-z0-9_:-]*))\s*$/iu;
const TOOL_NAME = /^[a-z][a-z0-9_:-]*$/u;

const isMissingPath = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && error.code === 'ENOENT';

export const parseSkillAllowedTools = (content: string): readonly string[] => {
  const tools: string[] = [];
  let insideAllowedTools = false;

  for (const line of content.split(/\r?\n/u)) {
    if (ALLOWED_TOOLS_HEADING.test(line.trim())) {
      insideAllowedTools = true;
      continue;
    }
    if (insideAllowedTools && NEXT_HEADING.test(line.trim())) {
      insideAllowedTools = false;
      continue;
    }
    if (!insideAllowedTools) {
      continue;
    }

    const match = TOOL_LIST_ITEM.exec(line);
    const tool = match?.[1] ?? match?.[2];
    if (tool !== undefined && TOOL_NAME.test(tool)) {
      tools.push(tool);
    }
  }

  return Object.freeze([...new Set(tools)]);
};

@Injectable()
export class SkillLoaderService {
  constructor(private readonly channelRegistry: ChannelRegistryService) {}

  async loadSkills(
    channelId: string,
    requestedSkills: readonly string[],
  ): Promise<readonly LoadedSkill[]> {
    assertSafeIdentifier(channelId);
    const skillNames = [...new Set(requestedSkills)];
    skillNames.forEach(assertSafeIdentifier);
    skillNames.sort();

    if (skillNames.length === 0) {
      return Object.freeze([]);
    }

    const workspace = await this.channelRegistry.getChannelWorkspace(channelId);
    const skillsPath = path.join(workspace.harnessPath, 'skills');
    try {
      await assertDirectoryInside(workspace.workspacePath, skillsPath);
    } catch (error) {
      if (isMissingPath(error)) {
        throw new SkillNotFoundError(workspace.channelId, skillNames[0]);
      }
      throw error;
    }

    const skills: LoadedSkill[] = [];
    for (const skillName of skillNames) {
      const filePath = path.join(skillsPath, `${skillName}.md`);
      try {
        const stats = await lstat(filePath);
        if (!stats.isFile()) {
          throw new SkillNotFoundError(workspace.channelId, skillName);
        }
      } catch (error) {
        if (isMissingPath(error)) {
          throw new SkillNotFoundError(workspace.channelId, skillName);
        }
        throw error;
      }

      const document = await readMarkdownDocument(workspace, filePath);
      skills.push(
        Object.freeze({
          ...document,
          allowedTools: parseSkillAllowedTools(document.content),
        }),
      );
    }

    return Object.freeze(skills);
  }
}
