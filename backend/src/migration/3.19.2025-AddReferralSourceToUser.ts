// Path: c:\Users\PSXLHP276\sewsuite-saas\backend\src\migrations\[timestamp]-AddReferralSourceToUser.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReferralSourceToUser1710877200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "referralSource" VARCHAR(255);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "referralSource";`,
    );
  }
}
