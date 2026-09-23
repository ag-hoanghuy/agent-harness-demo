import { parse } from 'yaml';
import { asChannelId } from '../../contracts/ids.js';
import { InvalidChannelConfigError } from './channel-runtime.errors.js';
import { ChannelConfig } from './contracts/channel-config.contract.js';
import { isSafeIdentifier } from './filesystem-safety.js';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readRecord = (source: UnknownRecord, key: string): UnknownRecord => {
  const value = source[key];
  if (!isRecord(value)) {
    throw new InvalidChannelConfigError(`${key} phải là object`);
  }
  return value;
};

const readString = (source: UnknownRecord, key: string): string => {
  const value = source[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new InvalidChannelConfigError(`${key} phải là chuỗi không rỗng`);
  }
  return value.trim();
};

const readBoolean = (source: UnknownRecord, key: string): boolean => {
  const value = source[key];
  if (typeof value !== 'boolean') {
    throw new InvalidChannelConfigError(`${key} phải là boolean`);
  }
  return value;
};

const readInteger = (
  source: UnknownRecord,
  key: string,
  minimum: number,
): number => {
  const value = source[key];
  if (!Number.isInteger(value) || (value as number) < minimum) {
    throw new InvalidChannelConfigError(
      `${key} phải là số nguyên lớn hơn hoặc bằng ${minimum}`,
    );
  }
  return value as number;
};

const readStringArray = (
  source: UnknownRecord,
  key: string,
): readonly string[] => {
  const value = source[key];
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== 'string' || item.trim() === '')
  ) {
    throw new InvalidChannelConfigError(
      `${key} phải là mảng các chuỗi không rỗng`,
    );
  }
  return Object.freeze([...new Set(value.map((item) => item.trim()))]);
};

export const parseChannelConfig = (content: string): ChannelConfig => {
  let rawConfig: unknown;
  try {
    rawConfig = parse(content);
  } catch (error) {
    throw new InvalidChannelConfigError('không thể parse YAML', {
      cause: error,
    });
  }

  if (!isRecord(rawConfig)) {
    throw new InvalidChannelConfigError('document gốc phải là object');
  }

  const concurrency = readRecord(rawConfig, 'concurrency');
  const autonomy = readRecord(rawConfig, 'autonomy');
  const limits = readRecord(rawConfig, 'limits');
  const channelId = readString(rawConfig, 'channel_id');
  if (!isSafeIdentifier(channelId)) {
    throw new InvalidChannelConfigError(
      'channel_id không phải identifier an toàn',
    );
  }

  return Object.freeze({
    channelId: asChannelId(channelId),
    enabled: readBoolean(rawConfig, 'enabled'),
    timezone: readString(rawConfig, 'timezone'),
    concurrency: Object.freeze({
      maxActiveRuns: readInteger(concurrency, 'max_active_runs', 1),
    }),
    autonomy: Object.freeze({
      level: readString(autonomy, 'level'),
    }),
    requiredGates: readStringArray(rawConfig, 'required_gates'),
    limits: Object.freeze({
      maxRetriesPerStep: readInteger(limits, 'max_retries_per_step', 0),
    }),
    allowedTools: readStringArray(rawConfig, 'allowed_tools'),
  });
};
