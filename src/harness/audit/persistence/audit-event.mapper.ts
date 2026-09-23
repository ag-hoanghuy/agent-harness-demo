import {
  asAuditEventId,
  asChannelId,
  asCorrelationId,
  asEpisodeId,
  asRunId,
} from '../../../contracts/ids.js';
import { AUDIT_EVENT_SCHEMA_VERSION } from '../../../contracts/schema-version.js';
import { AuditEvent } from '../audit-event.contract.js';
import { AuditEventEntity } from './audit-event.entity.js';

export class AuditEventMapper {
  static toEntity(event: AuditEvent): AuditEventEntity {
    const entity = new AuditEventEntity();
    entity.id = event.id;
    entity.run_id = event.run_id;
    entity.episode_id = event.episode_id ?? null;
    entity.channel_id = event.channel_id;
    entity.event_type = event.event_type;
    entity.actor = event.actor;
    entity.correlation_id = event.correlation_id;
    entity.metadata = { ...event.metadata };
    entity.schema_version = event.schema_version;
    entity.created_at = new Date(event.created_at);
    return entity;
  }

  static toDomain(entity: AuditEventEntity): AuditEvent {
    return {
      id: asAuditEventId(entity.id),
      run_id: asRunId(entity.run_id),
      episode_id:
        entity.episode_id === null ? undefined : asEpisodeId(entity.episode_id),
      channel_id: asChannelId(entity.channel_id),
      event_type: entity.event_type,
      actor: entity.actor,
      correlation_id: asCorrelationId(entity.correlation_id),
      metadata: entity.metadata,
      schema_version:
        entity.schema_version as typeof AUDIT_EVENT_SCHEMA_VERSION,
      created_at: entity.created_at.toISOString(),
    };
  }
}
