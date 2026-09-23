import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddToolCallIdempotency1790208000000 implements MigrationInterface {
  name = 'AddToolCallIdempotency1790208000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_tool_calls_run_tool_correlation"
      ON "tool_calls" ("run_id", "tool_name", "correlation_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "UQ_tool_calls_run_tool_correlation"');
  }
}
