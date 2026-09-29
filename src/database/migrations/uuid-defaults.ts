import { MigrationInterface, QueryRunner } from 'typeorm';

export class UuidDefaults1770000000001 implements MigrationInterface {
  name = 'UuidDefaults1770000000001';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "orders" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()',
    );
    await queryRunner.query(
      'ALTER TABLE "order_items" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "order_items" ALTER COLUMN "id" DROP DEFAULT');
    await queryRunner.query('ALTER TABLE "orders" ALTER COLUMN "id" DROP DEFAULT');
  }
}