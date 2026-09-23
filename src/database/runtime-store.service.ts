import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditEvent } from '../harness/audit/audit-event.contract.js';
import { TypeOrmAuditEventRepository } from '../harness/audit/persistence/typeorm-audit-event.repository.js';
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
    return this.dataSource.transaction(async (manager) => {
      const runRepository = TypeOrmRunRepository.fromManager(manager);
      const auditRepository = TypeOrmAuditEventRepository.fromManager(manager);

      const savedRun = await runRepository.save(run, expectedVersion);
      await auditRepository.append(auditEvent);

      return savedRun;
    });
  }
}
