import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { RunId } from '../../../contracts/ids.js';
import { Checkpoint } from '../checkpoint.contract.js';
import { CheckpointRepository } from '../checkpoint.repository.js';
import { CheckpointEntity } from './checkpoint.entity.js';
import { CheckpointMapper } from './checkpoint.mapper.js';

@Injectable()
export class TypeOrmCheckpointRepository implements CheckpointRepository {
  constructor(
    @InjectRepository(CheckpointEntity)
    private readonly entities: Repository<CheckpointEntity>,
  ) {}

  static fromManager(manager: EntityManager): TypeOrmCheckpointRepository {
    return new TypeOrmCheckpointRepository(
      manager.getRepository(CheckpointEntity),
    );
  }

  async append(checkpoint: Checkpoint): Promise<Checkpoint> {
    const entity = CheckpointMapper.toEntity(checkpoint);
    await this.entities.insert(entity);
    return CheckpointMapper.toDomain(entity);
  }

  async findLatestByRunId(runId: RunId): Promise<Checkpoint | null> {
    const entity = await this.entities.findOne({
      where: { run_id: runId },
      order: { created_at: 'DESC', id: 'DESC' },
    });
    return entity === null ? null : CheckpointMapper.toDomain(entity);
  }
}
