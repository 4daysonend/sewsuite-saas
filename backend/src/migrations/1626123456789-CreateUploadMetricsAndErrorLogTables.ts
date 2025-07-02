import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUploadMetricsAndErrorLogTables1626123456789
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create upload_metrics table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "upload_metrics" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "fileId" varchar NOT NULL,
        "userId" varchar NOT NULL,
        "fileType" varchar NOT NULL,
        "fileSize" integer NOT NULL,
        "processingTimeMs" integer NOT NULL,
        "status" varchar NOT NULL,
        "errorMessage" varchar,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "status_check" CHECK (status IN ('success', 'failed'))
      )
    `);

    // Create indices for upload_metrics
    await queryRunner.query(
      `CREATE INDEX "IDX_upload_metrics_fileId" ON "upload_metrics" ("fileId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_upload_metrics_userId" ON "upload_metrics" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_upload_metrics_status" ON "upload_metrics" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_upload_metrics_createdAt" ON "upload_metrics" ("createdAt")`,
    );

    // Create error_logs table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "error_logs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "source" varchar NOT NULL,
        "message" varchar NOT NULL,
        "details" text,
        "stack" text,
        "metadata" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // Create indices for error_logs
    await queryRunner.query(
      `CREATE INDEX "IDX_error_logs_source" ON "error_logs" ("source")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_error_logs_source_createdAt" ON "error_logs" ("source", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_error_logs_createdAt" ON "error_logs" ("createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "upload_metrics"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "error_logs"`);
  }
}
