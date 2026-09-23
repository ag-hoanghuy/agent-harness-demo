import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryDeepPartialEntity, Repository } from 'typeorm';
import { RunId } from '../../../contracts/ids.js';
import { AuditEvent } from '../audit-event.contract.js';
import { AuditEventRepository } from '../audit-event.repository.js';
import { AuditEventEntity } from './audit-event.entity.js';
import { AuditEventMapper } from './audit-event.mapper.js';

@Injectable()
export class TypeOrmAuditEventRepository implements AuditEventRepository {
  constructor(
    @InjectRepository(AuditEventEntity)
    private readonly entities: Repository<AuditEventEntity>,
  ) {}

  static fromManager(manager: EntityManager): TypeOrmAuditEventRepository {
    return new TypeOrmAuditEventRepository(
      manager.getRepository(AuditEventEntity),
    );
  }

  async append(event: AuditEvent): Promise<AuditEvent> {
    const entity = AuditEventMapper.toEntity(event);
    await this.entities.insert(
      entity as QueryDeepPartialEntity<AuditEventEntity>,
    );
    return AuditEventMapper.toDomain(entity);
  }

  async findByRunId(runId: RunId): Promise<readonly AuditEvent[]> {
    const entities = await this.entities.find({
      where: { run_id: runId },
      order: { created_at: 'ASC', id: 'ASC' },
    });
    return entities.map((entity) => AuditEventMapper.toDomain(entity));
  }
}
