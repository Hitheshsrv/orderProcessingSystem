import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1770000000000 implements MigrationInterface {
  name = 'InitialSchema1770000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE inventory (
        sku varchar(64) PRIMARY KEY,
        name varchar(160) NOT NULL,
        unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
        available_quantity integer NOT NULL CHECK (available_quantity >= 0),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE orders (
        id uuid PRIMARY KEY,
        idempotency_key varchar(255) NOT NULL UNIQUE,
        request_hash varchar(64) NOT NULL,
        status varchar(20) NOT NULL CHECK (status IN ('PLACED')),
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE order_items (
        id uuid PRIMARY KEY,
        order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        sku varchar(64) NOT NULL REFERENCES inventory(sku) ON DELETE RESTRICT,
        quantity integer NOT NULL CHECK (quantity > 0),
        unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0)
      )
    `);
    await queryRunner.query(`
      INSERT INTO inventory (sku, name, unit_price_cents, available_quantity) VALUES
        ('SKU-001', 'Mechanical Keyboard', 8999, 20),
        ('SKU-002', 'Wireless Mouse', 3999, 35),
        ('SKU-003', 'USB-C Hub', 5499, 12)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE order_items');
    await queryRunner.query('DROP TABLE orders');
    await queryRunner.query('DROP TABLE inventory');
  }
}