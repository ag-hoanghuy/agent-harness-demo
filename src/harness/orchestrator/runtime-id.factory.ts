import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  asAuditEventId,
  asCheckpointId,
  asRunId,
  AuditEventId,
  CheckpointId,
  RunId,
} from '../../contracts/ids.js';

@Injectable()
export class RuntimeIdFactory {
  createRunId(): RunId {
    return asRunId(randomUUID());
  }

  createAuditEventId(): AuditEventId {
    return asAuditEventId(randomUUID());
  }

  createCheckpointId(): CheckpointId {
    return asCheckpointId(randomUUID());
  }
}
