import { RunId } from '../../contracts/ids.js';

export class RunNotFoundError extends Error {
  constructor(runId: RunId) {
    super(`Không tìm thấy Harness Run: ${runId}`);
    this.name = 'RunNotFoundError';
  }
}

export class RunVersionConflictError extends Error {
  constructor(runId: RunId, expectedVersion: number) {
    super(
      `Xung đột phiên bản Harness Run ${runId}; expected version ${expectedVersion}`,
    );
    this.name = 'RunVersionConflictError';
  }
}
