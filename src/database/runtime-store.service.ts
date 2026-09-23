import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditEvent } from '../harness/audit/audit-event.contract.js';
import { TypeOrmAuditEventRepository } from '../harness/audit/persistence/typeorm-audit-event.repository.js';
import { Checkpoint } from '../harness/checkpoint/checkpoint.contract.js';
import { TypeOrmCheckpointRepository } from '../harness/checkpoint/persistence/typeorm-checkpoint.repository.js';
import { HarnessRun } from '../harness/run/run.contract.js';
import { TypeOrmRunRepository } from '../harness/run/persistence/typeorm-run.repository.js';

@Injectable()
export class RuntimeStoreService {
  constructor(private readonly dataSource: DataSource) {}

  async saveRunWithAudit(
    run: HarnessRun,
    expectedVersion: number,
    auditEvent: AuditEvent,
  ): Promise<HarnessRun> {
    return this.saveRunWithAudits(run, expectedVersion, [auditEvent]);
  }

  async createRunWithAudit(
    run: HarnessRun,
    auditEvent: AuditEvent,
  ): Promise<HarnessRun> {
    return this.dataSource.transaction(async (manager) => {
      const runRepository = TypeOrmRunRepository.fromManager(manager);
      const auditRepository = TypeOrmAuditEventRepository.fromManager(manager);

      const savedRun = await runRepository.create(run);
      await auditRepository.append(auditEvent);

      return savedRun;
    });
  }

  async saveRunWithAudits(
    run: HarnessRun,
    expectedVersion: number,
    auditEvents: readonly AuditEvent[],
  ): Promise<HarnessRun> {
    return this.dataSource.transaction(async (manager) => {
      const runRepository = TypeOrmRunRepository.fromManager(manager);
      const auditRepository = TypeOrmAuditEventRepository.fromManager(manager);

      const savedRun = await runRepository.save(run, expectedVersion);
      for (const auditEvent of auditEvents) {
        await auditRepository.append(auditEvent);
      }

      return savedRun;
    });
  }

  async saveRunWithCheckpointAndAudits(
    run: HarnessRun,
    expectedVersion: number,
    checkpoint: Checkpoint,
    auditEvents: readonly AuditEvent[],
  ): Promise<HarnessRun> {
    return this.dataSource.transaction(async (manager) => {
      const runRepository = TypeOrmRunRepository.fromManager(manager);
      const checkpointRepository =
        TypeOrmCheckpointRepository.fromManager(manager);
      const auditRepository = TypeOrmAuditEventRepository.fromManager(manager);

      await checkpointRepository.append(checkpoint);
      const savedRun = await runRepository.save(run, expectedVersion);
      for (const auditEvent of auditEvents) {
        await auditRepository.append(auditEvent);
      }

      return savedRun;
    });
  }
}
