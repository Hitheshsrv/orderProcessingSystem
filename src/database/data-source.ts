import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { databaseEntities, databaseMigrations } from './database.constants.js';

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: databaseEntities,
  migrations: databaseMigrations,
  synchronize: false,
});