import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryDeepPartialEntity, Repository } from 'typeorm';
import { RunId, ToolCallId } from '../../../contracts/ids.js';
import { ToolCall } from '../tool.contract.js';
import { ToolCallNotFoundError } from '../tool-call.errors.js';
import {
  ToolCallRepository,
  ToolCallStatusUpdate,
} from '../tool-call.repository.js';
import { ToolCallEntity } from './tool-call.entity.js';
import { ToolCallMapper } from './tool-call.mapper.js';

@Injectable()
export class TypeOrmToolCallRepository implements ToolCallRepository {
  constructor(
    @InjectRepository(ToolCallEntity)
    private readonly entities: Repository<ToolCallEntity>,
  ) {}

  async create(toolCall: ToolCall): Promise<ToolCall> {
    await this.entities.insert(
      ToolCallMapper.toEntity(
        toolCall,
      ) as QueryDeepPartialEntity<ToolCallEntity>,
    );
    return this.getRequired(toolCall.id);
  }

  async updateStatus(
    id: ToolCallId,
    update: ToolCallStatusUpdate,
  ): Promise<ToolCall> {
    const updateValues = {
      status: update.status,
      output: update.output ?? null,
      error: update.error ? { ...update.error } : null,
      completed_at: update.completed_at ? new Date(update.completed_at) : null,
    } as QueryDeepPartialEntity<ToolCallEntity>;
    const result = await this.entities.update({ id }, updateValues);
    if (result.affected === 0) {
      throw new ToolCallNotFoundError(id);
    }
    return this.getRequired(id);
  }

  async findById(id: ToolCallId): Promise<ToolCall | null> {
    const entity = await this.entities.findOneBy({ id });
    return entity === null ? null : ToolCallMapper.toDomain(entity);
  }

  async findByRunId(runId: RunId): Promise<readonly ToolCall[]> {
    const entities = await this.entities.find({
      where: { run_id: runId },
      order: { created_at: 'ASC', id: 'ASC' },
    });
    return entities.map((entity) => ToolCallMapper.toDomain(entity));
  }

  private async getRequired(id: ToolCallId): Promise<ToolCall> {
    const toolCall = await this.findById(id);
    if (toolCall === null) {
      throw new ToolCallNotFoundError(id);
    }
    return toolCall;
  }
}
