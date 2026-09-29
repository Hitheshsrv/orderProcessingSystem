import { InventoryItem } from '../inventory/inventory-item.entity.js';
import { OrderItemEntity } from '../orders/order-item.entity.js';
import { OrderEntity } from '../orders/order.entity.js';
import { InitialSchema1770000000000 } from './migrations/initial-schema.js';
import { UuidDefaults1770000000001 } from './migrations/uuid-defaults.js';
import { PaymentLifecycle1770000000002 } from './migrations/payment-lifecycle.js';

export const databaseEntities = [InventoryItem, OrderEntity, OrderItemEntity];
export const databaseMigrations = [
	InitialSchema1770000000000,
	UuidDefaults1770000000001,
	PaymentLifecycle1770000000002,
];