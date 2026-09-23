import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditEvent } from '../harness/audit/audit-event.contract.js';
import { TypeOrmAuditEventRepository } from '../harness/audit/persistence/typeorm-audit-event.repository.js';
import { Checkpoint } from '../harness/checkpoint/checkpoint.contract.js';
import { TypeOrmCheckpointRepository } from '../harness/checkpoint/persistence/typeorm-checkpoint.repository.js';
import { HarnessRun } from '../harness/run/run.contract.js';
import { TypeOrmRunRepository } from '../harness/run/persistence/typeorm-run.repository.js';
import { TypeOrmToolCallRepository } from '../harness/tool-broker/persistence/typeorm-tool-call.repository.js';
import type {
  ToolCallRepository,
  ToolCallStatusUpdate,
} from '../harness/tool-broker/tool-call.repository.js';
import type { ToolCall } from '../harness/tool-broker/tool.contract.js';
import type { ToolCallId } from '../contracts/ids.js';

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

  async createToolCallWithAudit(
    toolCall: ToolCall,
    auditEvent: AuditEvent,
  ): Promise<ToolCall> {
    return this.dataSource.transaction(async (manager) => {
      const toolCallRepository = TypeOrmToolCallRepository.fromManager(manager);
      const auditRepository = TypeOrmAuditEventRepository.fromManager(manager);

      const savedToolCall = await toolCallRepository.create(toolCall);
      await auditRepository.append(auditEvent);

      return savedToolCall;
    });
  }

  async updateToolCall(
    toolCallId: ToolCallId,
    update: ToolCallStatusUpdate,
  ): Promise<ToolCall> {
    return this.updateToolCallWithAudits(toolCallId, update, []);
  }

  async updateToolCallWithAudit(
    toolCallId: ToolCallId,
    update: ToolCallStatusUpdate,
    auditEvent: AuditEvent,
  ): Promise<ToolCall> {
    return this.updateToolCallWithAudits(toolCallId, update, [auditEvent]);
  }

  async updateToolCallWithAudits(
    toolCallId: ToolCallId,
    update: ToolCallStatusUpdate,
    auditEvents: readonly AuditEvent[],
  ): Promise<ToolCall> {
    return this.dataSource.transaction(async (manager) => {
      const toolCallRepository: ToolCallRepository =
        TypeOrmToolCallRepository.fromManager(manager);
      const auditRepository = TypeOrmAuditEventRepository.fromManager(manager);

      const savedToolCall = await toolCallRepository.updateStatus(
        toolCallId,
        update,
      );
      for (const auditEvent of auditEvents) {
        await auditRepository.append(auditEvent);
      }

      return savedToolCall;
    });
  }
}
