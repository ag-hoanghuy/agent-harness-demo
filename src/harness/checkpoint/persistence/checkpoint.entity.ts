import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';
import { HarnessRunState } from '../../run/run-state.enum.js';
import { RunStep } from '../../run/run-step.enum.js';

@Entity({ name: 'run_checkpoints' })
@Index('IDX_run_checkpoints_run_created', ['run_id', 'created_at'])
export class CheckpointEntity {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string;

  @Column({ type: 'varchar', length: 128 })
  run_id!: string;

  @Column({ type: 'varchar', length: 64 })
  step!: RunStep;

  @Column({ type: 'varchar', length: 64 })
  run_state!: HarnessRunState;

  @Column({ type: 'varchar', length: 128, nullable: true })
  episode_id!: string | null;

  @Column({ type: 'jsonb' })
  artifact_refs!: string[];

  @Column({ type: 'varchar', length: 128 })
  correlation_id!: string;

  @Column({ type: 'varchar', length: 32 })
  schema_version!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
