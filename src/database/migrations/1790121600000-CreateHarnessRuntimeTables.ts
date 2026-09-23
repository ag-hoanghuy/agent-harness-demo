import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateHarnessRuntimeTables1790121600000 implements MigrationInterface {
  name = 'CreateHarnessRuntimeTables1790121600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "harness_runs" (
        "id" varchar(128) NOT NULL,
        "channel_id" varchar(128) NOT NULL,
        "episode_id" varchar(128),
        "state" varchar(64) NOT NULL,
        "current_step" varchar(64),
        "retry_count" integer NOT NULL,
        "max_retries" integer NOT NULL,
        "schema_version" varchar(32) NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CHK_harness_runs_version_positive" CHECK ("version" > 0),
        CONSTRAINT "PK_harness_runs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_harness_runs_channel_id" ON "harness_runs" ("channel_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_harness_runs_state" ON "harness_runs" ("state")',
    );

    await queryRunner.query(`
      CREATE TABLE "run_checkpoints" (
        "id" varchar(128) NOT NULL,
        "run_id" varchar(128) NOT NULL,
        "step" varchar(64) NOT NULL,
        "run_state" varchar(64) NOT NULL,
        "episode_id" varchar(128),
        "artifact_refs" jsonb NOT NULL,
        "correlation_id" varchar(128) NOT NULL,
        "schema_version" varchar(32) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_run_checkpoints" PRIMARY KEY ("id"),
        CONSTRAINT "FK_run_checkpoints_run" FOREIGN KEY ("run_id")
          REFERENCES "harness_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_run_checkpoints_run_created" ON "run_checkpoints" ("run_id", "created_at")',
    );

    await queryRunner.query(`
      CREATE TABLE "audit_events" (
        "id" varchar(128) NOT NULL,
        "run_id" varchar(128) NOT NULL,
        "episode_id" varchar(128),
        "channel_id" varchar(128) NOT NULL,
        "event_type" varchar(64) NOT NULL,
        "actor" varchar(128) NOT NULL,
        "correlation_id" varchar(128) NOT NULL,
        "metadata" jsonb NOT NULL,
        "schema_version" varchar(32) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "PK_audit_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_audit_events_run" FOREIGN KEY ("run_id")
          REFERENCES "harness_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_audit_events_run_created" ON "audit_events" ("run_id", "created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_audit_events_correlation_id" ON "audit_events" ("correlation_id")',
    );

    await queryRunner.query(`
      CREATE TABLE "tool_calls" (
        "id" varchar(128) NOT NULL,
        "run_id" varchar(128) NOT NULL,
        "channel_id" varchar(128) NOT NULL,
        "tool_name" varchar(128) NOT NULL,
        "status" varchar(32) NOT NULL,
        "input" jsonb NOT NULL,
        "output" jsonb,
        "error" jsonb,
        "correlation_id" varchar(128) NOT NULL,
        "schema_version" varchar(32) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "completed_at" timestamptz,
        CONSTRAINT "PK_tool_calls" PRIMARY KEY ("id"),
        CONSTRAINT "FK_tool_calls_run" FOREIGN KEY ("run_id")
          REFERENCES "harness_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "IDX_tool_calls_run_id" ON "tool_calls" ("run_id")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_tool_calls_status" ON "tool_calls" ("status")',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_tool_calls_correlation_id" ON "tool_calls" ("correlation_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "tool_calls"');
    await queryRunner.query('DROP TABLE "audit_events"');
    await queryRunner.query('DROP TABLE "run_checkpoints"');
    await queryRunner.query('DROP TABLE "harness_runs"');
  }
}
