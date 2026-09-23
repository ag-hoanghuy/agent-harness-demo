import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Not, Repository } from 'typeorm';
import { ChannelId, RunId } from '../../../contracts/ids.js';
import { HarnessRun } from '../run.contract.js';
import { RunNotFoundError, RunVersionConflictError } from '../run.errors.js';
import { RunRepository } from '../run.repository.js';
import { HarnessRunState } from '../run-state.enum.js';
import { RunEntity } from './run.entity.js';
import { RunMapper } from './run.mapper.js';

@Injectable()
export class TypeOrmRunRepository implements RunRepository {
  constructor(
    @InjectRepository(RunEntity)
    private readonly entities: Repository<RunEntity>,
  ) {}

  static fromManager(manager: EntityManager): TypeOrmRunRepository {
    return new TypeOrmRunRepository(manager.getRepository(RunEntity));
  }

  async create(run: HarnessRun): Promise<HarnessRun> {
    await this.entities.insert(RunMapper.toEntity(run));
    return this.getRequired(run.id);
  }

  async findById(id: RunId): Promise<HarnessRun | null> {
    const entity = await this.entities.findOneBy({ id });
    return entity === null ? null : RunMapper.toDomain(entity);
  }

  async save(run: HarnessRun, expectedVersion: number): Promise<HarnessRun> {
    const entity = RunMapper.toEntity(run);
    const result = await this.entities
      .createQueryBuilder()
      .update(RunEntity)
      .set({
        channel_id: entity.channel_id,
        episode_id: entity.episode_id,
        state: entity.state,
        current_step: entity.current_step,
        retry_count: entity.retry_count,
        max_retries: entity.max_retries,
        schema_version: entity.schema_version,
        version: () => '"version" + 1',
        updated_at: () => 'CURRENT_TIMESTAMP',
      })
      .where('"id" = :id', { id: run.id })
      .andWhere('"version" = :expectedVersion', { expectedVersion })
      .execute();

    if (result.affected === 0) {
      const exists = await this.entities.existsBy({ id: run.id });
      if (!exists) {
        throw new RunNotFoundError(run.id);
      }
      throw new RunVersionConflictError(run.id, expectedVersion);
    }

    return this.getRequired(run.id);
  }

  async findActiveByChannel(
    channelId: ChannelId,
  ): Promise<readonly HarnessRun[]> {
    const entities = await this.entities.find({
      where: {
        channel_id: channelId,
        state: Not(
          In([HarnessRunState.COMPLETED, HarnessRunState.FAILED_FINAL]),
        ),
      },
      order: { created_at: 'DESC' },
    });
    return entities.map((entity) => RunMapper.toDomain(entity));
  }

  private async getRequired(id: RunId): Promise<HarnessRun> {
    const run = await this.findById(id);
    if (run === null) {
      throw new RunNotFoundError(id);
    }
    return run;
  }
}
