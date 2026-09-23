import { AUDIT_EVENT_SCHEMA_VERSION } from '../../contracts/schema-version.js';
import {
  AuditEventId,
  ChannelId,
  CorrelationId,
  EpisodeId,
  RunId,
} from '../../contracts/ids.js';
import { AuditEventType } from './audit-event-type.enum.js';

export interface AuditEvent {
  id: AuditEventId;
  run_id: RunId;
  episode_id?: EpisodeId;
  channel_id: ChannelId;
  event_type: AuditEventType;
  actor: string;
  correlation_id: CorrelationId;
  metadata: Readonly<Record<string, unknown>>;
  created_at: string;
  schema_version: typeof AUDIT_EVENT_SCHEMA_VERSION;
}
