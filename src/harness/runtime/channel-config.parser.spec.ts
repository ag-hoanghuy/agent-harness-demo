import { InvalidChannelConfigError } from './channel-runtime.errors.js';
import { parseChannelConfig } from './channel-config.parser.js';

const validConfig = `
channel_id: channel-test
enabled: true
timezone: Asia/Ho_Chi_Minh
concurrency:
  max_active_runs: 2
autonomy:
  level: L2
required_gates:
  - draft_review
limits:
  max_retries_per_step: 0
allowed_tools:
  - search_assets
`;

describe('parseChannelConfig', () => {
  it('chuyển raw YAML thành ChannelConfig có cấu trúc', () => {
    const config = parseChannelConfig(validConfig);

    expect(config).toEqual({
      channelId: 'channel-test',
      enabled: true,
      timezone: 'Asia/Ho_Chi_Minh',
      concurrency: { maxActiveRuns: 2 },
      autonomy: { level: 'L2' },
      requiredGates: ['draft_review'],
      limits: { maxRetriesPerStep: 0 },
      allowedTools: ['search_assets'],
    });
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('từ chối YAML không parse được', () => {
    expect(() => parseChannelConfig('channel_id: [')).toThrowError(
      InvalidChannelConfigError,
    );
  });

  it.each([
    ['thiếu channel_id', validConfig.replace('channel_id: channel-test\n', '')],
    [
      'channel_id chứa path separator',
      validConfig.replace('channel_id: channel-test', 'channel_id: ../secret'),
    ],
    [
      'enabled không phải boolean',
      validConfig.replace('enabled: true', 'enabled: yes'),
    ],
    ['thiếu timezone', validConfig.replace('timezone: Asia/Ho_Chi_Minh\n', '')],
    [
      'max_active_runs bằng 0',
      validConfig.replace('max_active_runs: 2', 'max_active_runs: 0'),
    ],
    [
      'max_retries_per_step âm',
      validConfig.replace(
        'max_retries_per_step: 0',
        'max_retries_per_step: -1',
      ),
    ],
    [
      'required_gates không phải array',
      validConfig.replace(
        'required_gates:\n  - draft_review',
        'required_gates: draft_review',
      ),
    ],
    [
      'allowed_tools không phải array',
      validConfig.replace(
        'allowed_tools:\n  - search_assets',
        'allowed_tools: search_assets',
      ),
    ],
  ])('từ chối config không hợp lệ: %s', (_caseName, content) => {
    expect(() => parseChannelConfig(content)).toThrowError(
      InvalidChannelConfigError,
    );
  });
});
