import { ChannelId, RunId } from '../../contracts/ids.js';
import { RunStep } from '../run/run-step.enum.js';

export class ChannelDisabledError extends Error {
  constructor(channelId: ChannelId) {
    super(`Channel đang bị tắt: ${channelId}`);
    this.name = 'ChannelDisabledError';
  }
}

export class RunCapacityExceededError extends Error {
  constructor(
    channelId: ChannelId,
    activeRunCount: number,
    maxActiveRuns: number,
  ) {
    super(
      `Channel ${channelId} đã đạt capacity ${activeRunCount}/${maxActiveRuns}`,
    );
    this.name = 'RunCapacityExceededError';
  }
}

export class InvalidPreflightStepError extends Error {
  constructor(runId: RunId, step: RunStep, reason: string) {
    super(`Run ${runId} không thể chuẩn bị step ${step}: ${reason}`);
    this.name = 'InvalidPreflightStepError';
  }
}

export class RunPreflightError extends Error {
  constructor(runId: RunId, options?: ErrorOptions) {
    super(`Preflight gặp lỗi hạ tầng cho Run ${runId}`, options);
    this.name = 'RunPreflightError';
  }
}
