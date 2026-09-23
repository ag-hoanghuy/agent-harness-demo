import { DataSourceOptions } from 'typeorm';
import { AuditEventEntity } from '../harness/audit/persistence/audit-event.entity.js';
import { CheckpointEntity } from '../harness/checkpoint/persistence/checkpoint.entity.js';
import { RunEntity } from '../harness/run/persistence/run.entity.js';
import { ToolCallEntity } from '../harness/tool-broker/persistence/tool-call.entity.js';
import { CreateHarnessRuntimeTables1790121600000 } from './migrations/1790121600000-CreateHarnessRuntimeTables.js';
import { AddToolCallIdempotency1790208000000 } from './migrations/1790208000000-AddToolCallIdempotency.js';
import { DatabaseConfigurationError } from './database.errors.js';

const readRequired = (environment: NodeJS.ProcessEnv, key: string): string => {
  const value = environment[key]?.trim();
  if (!value) {
    throw new DatabaseConfigurationError(
      `Thiếu biến môi trường bắt buộc: ${key}`,
    );
  }
  return value;
};

const readPort = (environment: NodeJS.ProcessEnv): number => {
  const rawPort = readRequired(environment, 'POSTGRES_PORT');
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new DatabaseConfigurationError(
      `POSTGRES_PORT không hợp lệ: ${rawPort}`,
    );
  }
  return port;
};

export function createTypeOrmOptions(
  environment: NodeJS.ProcessEnv = process.env,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: readRequired(environment, 'POSTGRES_HOST'),
    port: readPort(environment),
    database: readRequired(environment, 'POSTGRES_DB'),
    username: readRequired(environment, 'POSTGRES_USER'),
    password: readRequired(environment, 'POSTGRES_PASSWORD'),
    entities: [RunEntity, CheckpointEntity, AuditEventEntity, ToolCallEntity],
    migrations: [
      CreateHarnessRuntimeTables1790121600000,
      AddToolCallIdempotency1790208000000,
    ],
    migrationsTableName: 'typeorm_migrations',
    synchronize: false,
    migrationsRun: false,
    logging: false,
  };
}
