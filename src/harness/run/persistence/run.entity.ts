import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { HarnessRunState } from '../run-state.enum.js';
import { RunStep } from '../run-step.enum.js';

@Entity({ name: 'harness_runs' })
@Index('IDX_harness_runs_channel_id', ['channel_id'])
@Index('IDX_harness_runs_state', ['state'])
export class RunEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string;

  @Column({ type: 'varchar', length: 128 })
  channel_id!: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  episode_id!: string | null;

  @Column({ type: 'varchar', length: 64 })
  state!: HarnessRunState;

  @Column({ type: 'varchar', length: 64, nullable: true })
  current_step!: RunStep | null;

  @Column({ type: 'integer' })
  retry_count!: number;

  @Column({ type: 'integer' })
  max_retries!: number;

  @Column({ type: 'varchar', length: 32 })
  schema_version!: string;

  @VersionColumn({ type: 'integer' })
  version!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
