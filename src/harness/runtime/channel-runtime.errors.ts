export class ChannelNotFoundError extends Error {
  constructor(channelId: string) {
    super(`Không tìm thấy channel workspace: ${channelId}`);
    this.name = 'ChannelNotFoundError';
  }
}

export class ChannelConfigNotFoundError extends Error {
  constructor(channelId: string) {
    super(`Không tìm thấy .harness/channel.yaml của channel: ${channelId}`);
    this.name = 'ChannelConfigNotFoundError';
  }
}

export class InvalidChannelConfigError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(`Channel config không hợp lệ: ${message}`, options);
    this.name = 'InvalidChannelConfigError';
  }
}

export class ChannelConfigMismatchError extends Error {
  constructor(requestedChannelId: string, configuredChannelId: string) {
    super(
      `Channel ID không khớp: workspace ${requestedChannelId}, channel.yaml ${configuredChannelId}`,
    );
    this.name = 'ChannelConfigMismatchError';
  }
}

export class SkillNotFoundError extends Error {
  constructor(channelId: string, skillName: string) {
    super(`Không tìm thấy skill ${skillName} trong channel ${channelId}`);
    this.name = 'SkillNotFoundError';
  }
}

export class UnsafeWorkspacePathError extends Error {
  constructor(value: string) {
    super(`Đường dẫn workspace không an toàn: ${value}`);
    this.name = 'UnsafeWorkspacePathError';
  }
}
