import { ToolCallId } from '../../contracts/ids.js';

export class ToolCallNotFoundError extends Error {
  constructor(toolCallId: ToolCallId) {
    super(`Không tìm thấy Tool Call: ${toolCallId}`);
    this.name = 'ToolCallNotFoundError';
  }
}
