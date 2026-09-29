# Order Processing System

A TypeScript/NestJS API and React workbench for exploring idempotent order creation, inventory locking, and payment failures against PostgreSQL.

## Run locally

Requires Node.js 22.22.3 or newer and PostgreSQL. Set `DATABASE_URL` in `.env` to your development database connection string.

Install dependencies and apply migrations once:

```powershell
npm ci
npm --prefix web ci
npm run db:migrate
```

Start the API in one terminal and the UI in another:

```powershell
npm run start:dev
```

```powershell
npm run ui:dev
```

Open `http://localhost:5173`. Vite proxies API requests to `http://127.0.0.1:3000`.

## Scenarios

- Choose **Approve**, **Decline**, or **Outage** to select the simulated payment result.
- Set the payment response delay from 0 to 15 seconds; the order stays in flight while the simulator waits.
- Replay any request from the activity list with the same idempotency key.
- Launch two checkouts simultaneously for all remaining units of the selected SKU. The inventory row lock allows one reservation; the other receives an insufficient-stock conflict.
- Restock the selected product to repeat the race. Restocking is a demo control and is disabled when `NODE_ENV=production` or `DEMO_MODE=false`.
- Repeated provider outages open the circuit breaker. The header shows its state; after 10 seconds it allows a half-open recovery attempt.

Stock reservation commits before payment simulation starts. A declined or failed payment changes the order to `PAYMENT_FAILED` and releases its reserved units in a separate locked transaction.

## API endpoints

- `GET /health` reports API liveness.
- `GET /inventory` returns current stock.
- `POST /orders` creates an order. Send `Idempotency-Key` and an `items` array; optional `paymentSimulation` fields control the local simulator.
- `GET /orders/:id` returns the current order status.
- `GET /payments/simulator` reports circuit-breaker state.
- `POST /inventory/:sku/restock` adds demo stock outside production mode.

## Checks

```powershell
npm run build
npm test
npm run test:e2e
npm run lint
npm --prefix web run build
npm --prefix web run lint
```
