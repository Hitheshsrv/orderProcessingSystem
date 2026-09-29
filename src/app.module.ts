import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { databaseEntities, databaseMigrations } from './database/database.constants.js';
import { OrdersModule } from './orders/orders.module.js';
import { InventoryModule } from './inventory/inventory.module.js';

const databaseModules =
  process.env.NODE_ENV === 'test'
    ? []
    : [
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            type: 'postgres' as const,
            url: configService.getOrThrow<string>('DATABASE_URL'),
            entities: databaseEntities,
            migrations: databaseMigrations,
            synchronize: false,
          }),
        }),
      ];
const featureModules = process.env.NODE_ENV === 'test' ? [] : [OrdersModule, InventoryModule];

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ...databaseModules, ...featureModules],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
