import { RunId } from '../../contracts/ids.js';
import { AuditEvent } from './audit-event.contract.js';

export const AUDIT_EVENT_REPOSITORY = Symbol('AUDIT_EVENT_REPOSITORY');

export interface AuditEventRepository {
  append(event: AuditEvent): Promise<AuditEvent>;
  findByRunId(runId: RunId): Promise<readonly AuditEvent[]>;
}
