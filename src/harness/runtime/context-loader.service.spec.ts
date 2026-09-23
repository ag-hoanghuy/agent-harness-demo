import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ChannelRegistryService } from '../control-plane/channel-registry.service.js';
import {
  ChannelConfigMismatchError,
  InvalidChannelConfigError,
  SkillNotFoundError,
  UnsafeWorkspacePathError,
} from './channel-runtime.errors.js';
import { ContextLoaderService } from './context-loader.service.js';
import { createContextSnapshot } from './context-snapshot.js';
import { SkillLoaderService } from './skill-loader.service.js';

interface FixtureOptions {
  readonly configuredChannelId?: string;
  readonly config?: string;
  readonly rules?: Readonly<Record<string, string>>;
  readonly skills?: Readonly<Record<string, string>>;
  readonly approvedMemory?: string;
}

const createLoader = (channelsRoot: string): ContextLoaderService => {
  const registry = new ChannelRegistryService(channelsRoot);
  return new ContextLoaderService(registry, new SkillLoaderService(registry));
};

const createFixtureChannel = async (
  channelsRoot: string,
  folderName: string,
  options: FixtureOptions = {},
): Promise<void> => {
  const harnessPath = path.join(channelsRoot, folderName, '.harness');
  await Promise.all([
    mkdir(path.join(harnessPath, 'rules'), { recursive: true }),
    mkdir(path.join(harnessPath, 'skills'), { recursive: true }),
    mkdir(path.join(harnessPath, 'memory'), { recursive: true }),
  ]);

  const channelId = options.configuredChannelId ?? folderName;
  const config =
    options.config ??
    `channel_id: ${channelId}
enabled: true
timezone: UTC
concurrency:
  max_active_runs: 1
autonomy:
  level: L2
required_gates: []
limits:
  max_retries_per_step: 1
allowed_tools:
  - a
  - b
  - c
`;
  await writeFile(path.join(harnessPath, 'channel.yaml'), config, 'utf8');

  for (const [fileName, content] of Object.entries(options.rules ?? {})) {
    await writeFile(path.join(harnessPath, 'rules', fileName), content, 'utf8');
  }
  for (const [fileName, content] of Object.entries(options.skills ?? {})) {
    await writeFile(
      path.join(harnessPath, 'skills', fileName),
      content,
      'utf8',
    );
  }
  if (options.approvedMemory !== undefined) {
    await writeFile(
      path.join(harnessPath, 'memory', 'approved-knowledge.md'),
      options.approvedMemory,
      'utf8',
    );
  }
};

describe('ContextLoaderService với channel thật', () => {
  const channelsRoot = path.resolve(process.cwd(), 'channels');
  const channelId = 'channel-vietnam-discovery';
  const loader = createLoader(channelsRoot);

  it('load config, rules và approved memory nhưng không tự load skill', async () => {
    const context = await loader.loadChannelContext(channelId);

    expect(context.channel.channelId).toBe(channelId);
    expect(context.channel.enabled).toBe(true);
    expect(context.channel.allowedTools).toEqual([
      'search_assets',
      'get_asset_metadata',
      'get_recent_analytics',
    ]);
    expect(context.rules.map((rule) => rule.name)).toEqual([
      'editorial',
      'footage',
    ]);
    expect(context.memory.map((document) => document.name)).toEqual([
      'approved-knowledge',
    ]);
    expect(context.skills).toEqual([]);
    expect(context.effectiveAllowedTools).toEqual([]);
    expect(
      [...context.rules, ...context.memory].every(
        (document) =>
          document.content.length > 0 &&
          /^[a-f0-9]{64}$/u.test(document.checksum),
      ),
    ).toBe(true);
  });

  it('trả checksum ổn định và snapshot không chứa nội dung tài liệu', async () => {
    const first = await loader.loadChannelContext(channelId, {
      skills: ['topic-research'],
    });
    const second = await loader.loadChannelContext(channelId, {
      skills: ['topic-research'],
    });
    const snapshot = createContextSnapshot(first);

    expect(first.rules.map(({ checksum }) => checksum)).toEqual(
      second.rules.map(({ checksum }) => checksum),
    );
    expect(snapshot.channelId).toBe(channelId);
    expect(snapshot.skills[0]).toEqual({
      name: 'topic-research',
      relativePath: '.harness/skills/topic-research.md',
      checksum: first.skills[0].checksum,
    });
    expect(snapshot.skills[0]).not.toHaveProperty('content');
  });

  it('chỉ load topic-research và giới hạn tool theo channel', async () => {
    const context = await loader.loadChannelContext(channelId, {
      skills: ['topic-research'],
    });

    expect(context.skills.map((skill) => skill.name)).toEqual([
      'topic-research',
    ]);
    expect(context.skills[0].allowedTools).toEqual([
      'search_assets',
      'get_recent_analytics',
    ]);
    expect(context.effectiveAllowedTools).toEqual([
      'search_assets',
      'get_recent_analytics',
    ]);
  });

  it('chỉ load creative-brief khi skill đó được yêu cầu', async () => {
    const context = await loader.loadChannelContext(channelId, {
      skills: ['creative-brief'],
    });

    expect(context.skills.map((skill) => skill.name)).toEqual([
      'creative-brief',
    ]);
    expect(context.skills.map((skill) => skill.name)).not.toContain(
      'topic-research',
    );
  });

  it('liệt kê deterministic các channel hợp lệ', async () => {
    const registry = new ChannelRegistryService(channelsRoot);
    await expect(registry.listChannels()).resolves.toContain(channelId);
  });
});

describe('ContextLoaderService với workspace fixture', () => {
  let fixtureRoot: string;

  beforeEach(async () => {
    fixtureRoot = await mkdtemp(path.join(tmpdir(), 'channel-runtime-'));
  });

  afterEach(async () => {
    await rm(fixtureRoot, { recursive: true, force: true });
  });

  it('từ chối YAML và config không hợp lệ', async () => {
    await createFixtureChannel(fixtureRoot, 'invalid-yaml', {
      config: 'channel_id: [',
    });
    await createFixtureChannel(fixtureRoot, 'invalid-config', {
      config: `channel_id: invalid-config
enabled: true
timezone: UTC
concurrency:
  max_active_runs: 0
autonomy:
  level: L2
required_gates: []
limits:
  max_retries_per_step: 0
allowed_tools: []
`,
    });

    await expect(
      createLoader(fixtureRoot).loadChannelContext('invalid-yaml'),
    ).rejects.toBeInstanceOf(InvalidChannelConfigError);
    await expect(
      createLoader(fixtureRoot).loadChannelContext('invalid-config'),
    ).rejects.toBeInstanceOf(InvalidChannelConfigError);
  });

  it('từ chối channel_id không khớp tên folder', async () => {
    await createFixtureChannel(fixtureRoot, 'channel-requested', {
      configuredChannelId: 'other-channel',
    });

    await expect(
      createLoader(fixtureRoot).loadChannelContext('channel-requested'),
    ).rejects.toBeInstanceOf(ChannelConfigMismatchError);
  });

  it('load rule deterministic và chỉ load approved memory', async () => {
    await createFixtureChannel(fixtureRoot, 'channel-documents', {
      rules: {
        'zeta.md': '# Zeta',
        'alpha.md': '# Alpha',
        'ignored.txt': 'không phải Markdown',
      },
      approvedMemory: '# Approved',
    });
    const draftMemoryPath = path.join(
      fixtureRoot,
      'channel-documents',
      '.harness',
      'memory',
      'draft.md',
    );
    await writeFile(draftMemoryPath, '# Draft', 'utf8');

    const context =
      await createLoader(fixtureRoot).loadChannelContext('channel-documents');

    expect(context.rules.map((rule) => rule.name)).toEqual(['alpha', 'zeta']);
    expect(context.memory.map((document) => document.name)).toEqual([
      'approved-knowledge',
    ]);
  });

  it('không trộn rules, skills hoặc memory giữa hai channel', async () => {
    await createFixtureChannel(fixtureRoot, 'channel-a', {
      rules: { 'a-rule.md': 'rule-A' },
      skills: { 'a-skill.md': '# Skill A' },
      approvedMemory: 'memory-A',
    });
    await createFixtureChannel(fixtureRoot, 'channel-b', {
      rules: { 'b-rule.md': 'rule-B' },
      skills: { 'b-skill.md': '# Skill B' },
      approvedMemory: 'memory-B',
    });

    const context = await createLoader(fixtureRoot).loadChannelContext(
      'channel-a',
      { skills: ['a-skill'] },
    );
    const allContent = [...context.rules, ...context.skills, ...context.memory]
      .map((document) => document.content)
      .join('\n');

    expect(allContent).toContain('A');
    expect(allContent).not.toContain('rule-B');
    expect(allContent).not.toContain('memory-B');
    expect(context.skills.map((skill) => skill.name)).toEqual(['a-skill']);
  });

  it('giao tool của skill với allowlist của channel', async () => {
    await createFixtureChannel(fixtureRoot, 'channel-tools', {
      skills: {
        'bounded-skill.md': `# Skill
## Allowed Tools
- \`a\`
- \`c\`
- \`forbidden\`
`,
      },
    });

    const context = await createLoader(fixtureRoot).loadChannelContext(
      'channel-tools',
      { skills: ['bounded-skill'] },
    );

    expect(context.skills[0].allowedTools).toEqual(['a', 'c', 'forbidden']);
    expect(context.effectiveAllowedTools).toEqual(['a', 'c']);
    expect(context.effectiveAllowedTools).not.toContain('forbidden');
  });

  it('báo lỗi khi skill không tồn tại hoặc tên skill không an toàn', async () => {
    await createFixtureChannel(fixtureRoot, 'channel-skills');
    const loader = createLoader(fixtureRoot);

    await expect(
      loader.loadChannelContext('channel-skills', { skills: ['missing'] }),
    ).rejects.toBeInstanceOf(SkillNotFoundError);
    await expect(
      loader.loadChannelContext('channel-skills', { skills: ['../secret'] }),
    ).rejects.toBeInstanceOf(UnsafeWorkspacePathError);
  });

  it('từ chối channel id chứa path traversal hoặc absolute path', async () => {
    const registry = new ChannelRegistryService(fixtureRoot);

    await expect(
      registry.getChannelWorkspace('../secret'),
    ).rejects.toBeInstanceOf(UnsafeWorkspacePathError);
    await expect(
      registry.getChannelWorkspace(path.resolve(fixtureRoot, 'channel-a')),
    ).rejects.toBeInstanceOf(UnsafeWorkspacePathError);
  });
});
