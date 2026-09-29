import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentLifecycle1770000000002 implements MigrationInterface {
  name = 'PaymentLifecycle1770000000002';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_status_check"');
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "orders_status_check" CHECK ("status" IN ('PLACED', 'PENDING_PAYMENT', 'PAID', 'PAYMENT_FAILED'))`,
    );
    await queryRunner.query('ALTER TABLE "orders" ADD COLUMN "payment_message" text');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_status_check"');
    await queryRunner.query(
      `ALTER TABLE "orders" ADD CONSTRAINT "orders_status_check" CHECK ("status" = 'PLACED')`,
    );
    await queryRunner.query('ALTER TABLE "orders" DROP COLUMN "payment_message"');
  }
}