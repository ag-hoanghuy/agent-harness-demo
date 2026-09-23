import { ToolCallId } from '../../contracts/ids.js';
import { ToolCallStatus } from './tool-call-status.enum.js';

export class ToolCallNotFoundError extends Error {
  constructor(toolCallId: ToolCallId) {
    super(`Không tìm thấy Tool Call: ${toolCallId}`);
    this.name = 'ToolCallNotFoundError';
  }
}

export class InvalidToolCallTransitionError extends Error {
  constructor(from: ToolCallStatus, to: ToolCallStatus) {
    super(`Chuyển trạng thái ToolCall không hợp lệ: ${from} -> ${to}`);
    this.name = 'InvalidToolCallTransitionError';
  }
}
