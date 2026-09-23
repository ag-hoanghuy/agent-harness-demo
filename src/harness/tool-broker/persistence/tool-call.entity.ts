import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { ToolCallStatus } from '../tool-call-status.enum.js';

@Entity({ name: 'tool_calls' })
@Index('IDX_tool_calls_run_id', ['run_id'])
@Index('IDX_tool_calls_status', ['status'])
@Index('IDX_tool_calls_correlation_id', ['correlation_id'])
@Index(
  'UQ_tool_calls_run_tool_correlation',
  ['run_id', 'tool_name', 'correlation_id'],
  { unique: true },
)
export class ToolCallEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string;

  @Column({ type: 'varchar', length: 128 })
  run_id!: string;

  @Column({ type: 'varchar', length: 128 })
  channel_id!: string;

  @Column({ type: 'varchar', length: 128 })
  tool_name!: string;

  @Column({ type: 'varchar', length: 32 })
  status!: ToolCallStatus;

  @Column({ type: 'jsonb' })
  input!: unknown;

  @Column({ type: 'jsonb', nullable: true })
  output!: unknown;

  @Column({ type: 'jsonb', nullable: true })
  error!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 128 })
  correlation_id!: string;

  @Column({ type: 'varchar', length: 32 })
  schema_version!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at!: Date | null;
}
