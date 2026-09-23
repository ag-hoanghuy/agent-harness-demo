import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { AuditEventType } from '../audit-event-type.enum.js';

@Entity({ name: 'audit_events' })
@Index('IDX_audit_events_run_created', ['run_id', 'created_at'])
@Index('IDX_audit_events_correlation_id', ['correlation_id'])
export class AuditEventEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string;

  @Column({ type: 'varchar', length: 128 })
  run_id!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  episode_id!: string | null;

  @Column({ type: 'varchar', length: 128 })
  channel_id!: string;

  @Column({ type: 'varchar', length: 64 })
  event_type!: AuditEventType;

  @Column({ type: 'varchar', length: 128 })
  actor!: string;

  @Column({ type: 'varchar', length: 128 })
  correlation_id!: string;

  @Column({ type: 'jsonb' })
  metadata!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 32 })
  schema_version!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
