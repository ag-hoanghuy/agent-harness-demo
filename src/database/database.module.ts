import 'dotenv/config';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AUDIT_EVENT_REPOSITORY } from '../harness/audit/audit-event.repository.js';
import { AuditEventEntity } from '../harness/audit/persistence/audit-event.entity.js';
import { TypeOrmAuditEventRepository } from '../harness/audit/persistence/typeorm-audit-event.repository.js';
import { CHECKPOINT_REPOSITORY } from '../harness/checkpoint/checkpoint.repository.js';
import { CheckpointEntity } from '../harness/checkpoint/persistence/checkpoint.entity.js';
import { TypeOrmCheckpointRepository } from '../harness/checkpoint/persistence/typeorm-checkpoint.repository.js';
import { RunEntity } from '../harness/run/persistence/run.entity.js';
import { TypeOrmRunRepository } from '../harness/run/persistence/typeorm-run.repository.js';
import { RUN_REPOSITORY } from '../harness/run/run.repository.js';
import { ToolCallEntity } from '../harness/tool-broker/persistence/tool-call.entity.js';
import { TypeOrmToolCallRepository } from '../harness/tool-broker/persistence/typeorm-tool-call.repository.js';
import { TOOL_CALL_REPOSITORY } from '../harness/tool-broker/tool-call.repository.js';
import { RuntimeStoreService } from './runtime-store.service.js';
import { createTypeOrmOptions } from './typeorm.config.js';

const entities = [
  RunEntity,
  CheckpointEntity,
  AuditEventEntity,
  ToolCallEntity,
];

@Module({
  imports: [
    TypeOrmModule.forRoot(createTypeOrmOptions()),
    TypeOrmModule.forFeature(entities),
  ],
  providers: [
    { provide: RUN_REPOSITORY, useClass: TypeOrmRunRepository },
    {
      provide: CHECKPOINT_REPOSITORY,
      useClass: TypeOrmCheckpointRepository,
    },
    {
      provide: AUDIT_EVENT_REPOSITORY,
      useClass: TypeOrmAuditEventRepository,
    },
    { provide: TOOL_CALL_REPOSITORY, useClass: TypeOrmToolCallRepository },
    RuntimeStoreService,
  ],
  exports: [
    RUN_REPOSITORY,
    CHECKPOINT_REPOSITORY,
    AUDIT_EVENT_REPOSITORY,
    TOOL_CALL_REPOSITORY,
    RuntimeStoreService,
  ],
})
export class DatabaseModule {}
