import { useEffect, useEffectEvent, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowDownUp,
  Check,
  CircleDollarSign,
  Clock3,
  CreditCard,
  ExternalLink,
  Package,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  X,
  Zap,
} from 'lucide-react'
import './order-desk.css'

type PaymentScenario = 'success' | 'decline' | 'provider-error'
type OrderStatus = 'PLACED' | 'PENDING_PAYMENT' | 'PAID' | 'PAYMENT_FAILED'
type ResultKind = 'paid' | 'payment-failed' | 'conflict' | 'error' | 'pending'

interface Product {
  sku: string
  name: string
  unitPriceCents: number
  availableQuantity: number
}

interface OrderRequest {
  items: Array<{ sku: string; quantity: number }>
  paymentSimulation: { outcome: PaymentScenario; delayMs: number }
}

interface OrderResponse {
  id: string
  status: OrderStatus
  createdAt: string
  paymentMessage?: string
  items: Array<{ sku: string; quantity: number; unitPriceCents: number }>
}

interface ActivityEntry {
  id: string
  key: string
  sku: string
  quantity: number
  startedAt: string
  request: OrderRequest
  result?: ResultKind
  order?: OrderResponse
  message?: string
  elapsedMs?: number
  replay: boolean
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const timestamp = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const currentTime = () => new Date()
const monotonicTime = () => performance.now()

function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedSku, setSelectedSku] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [scenario, setScenario] = useState<PaymentScenario>('success')
  const [delayMs, setDelayMs] = useState(1200)
  const [restockAmount, setRestockAmount] = useState(5)
  const [entries, setEntries] = useState<ActivityEntry[]>([])
  const [activeRequests, setActiveRequests] = useState(0)
  const [circuit, setCircuit] = useState<'closed' | 'open' | 'half-open' | 'unknown'>('unknown')
  const [connectionError, setConnectionError] = useState('')
  const [notice, setNotice] = useState('')
  const [racing, setRacing] = useState(false)

  const selectedProduct = products.find((product) => product.sku === selectedSku)

  async function refreshState() {
    try {
      const [inventoryResponse, circuitResponse] = await Promise.all([
        fetch('/api/inventory'),
        fetch('/api/payments/simulator'),
      ])
      if (!inventoryResponse.ok || !circuitResponse.ok) throw new Error('API request failed')
      const [inventory, payment] = await Promise.all([
        inventoryResponse.json() as Promise<Product[]>,
        circuitResponse.json() as Promise<{ circuit: 'closed' | 'open' | 'half-open' }>,
      ])
      setProducts(inventory)
      setCircuit(payment.circuit)
      setSelectedSku((current) => current || inventory[0]?.sku || '')
      setConnectionError('')
    } catch {
      setConnectionError('API unavailable. Start the NestJS server on port 3000.')
      setCircuit('unknown')
    }
  }

  const pollRefresh = useEffectEvent(() => {
    void refreshState()
  })

  useEffect(() => {
    const initialPoll = window.setTimeout(() => pollRefresh(), 0)
    const timer = window.setInterval(() => pollRefresh(), 2500)
    return () => {
      window.clearTimeout(initialPoll)
      window.clearInterval(timer)
    }
  }, [])

  async function submitOrder(request: OrderRequest, key: string, replay = false, refresh = true) {
    const entryId = crypto.randomUUID()
    const sku = request.items[0]?.sku ?? selectedSku
    const requestedQuantity = request.items.reduce((total, item) => total + item.quantity, 0)
    const startedAt = currentTime()
    const started = monotonicTime()
    const entry: ActivityEntry = {
      id: entryId,
      key,
      sku,
      quantity: requestedQuantity,
      startedAt: startedAt.toISOString(),
      request,
      replay,
    }

    setEntries((current) => [entry, ...current].slice(0, 16))
    setActiveRequests((current) => current + 1)

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body: JSON.stringify(request),
      })
      const body = await response.json()
      if (!response.ok) {
        const message = Array.isArray(body.message) ? body.message.join(', ') : body.message
        const result: ResultKind = response.status === 409 ? 'conflict' : 'error'
        setEntries((current) => current.map((item) => item.id === entryId
          ? { ...item, result, message: message || response.statusText, elapsedMs: monotonicTime() - started }
          : item))
      } else {
        const order = body as OrderResponse
        const result: ResultKind = order.status === 'PAID' || order.status === 'PLACED'
          ? 'paid'
          : order.status === 'PAYMENT_FAILED'
            ? 'payment-failed'
            : 'pending'
        setEntries((current) => current.map((item) => item.id === entryId
          ? { ...item, result, order, message: order.paymentMessage, elapsedMs: monotonicTime() - started }
          : item))
      }
    } catch (error) {
      setEntries((current) => current.map((item) => item.id === entryId
        ? {
            ...item,
            result: 'error',
            message: error instanceof Error ? error.message : 'Network error',
            elapsedMs: monotonicTime() - started,
          }
        : item))
    } finally {
      setActiveRequests((current) => Math.max(0, current - 1))
      if (refresh) void refreshState()
    }
  }

  function currentRequest(sku: string, requestedQuantity: number): OrderRequest {
    return {
      items: [{ sku, quantity: requestedQuantity }],
      paymentSimulation: { outcome: scenario, delayMs },
    }
  }

  function placeOrder() {
    if (!selectedProduct || quantity < 1) return
    void submitOrder(currentRequest(selectedProduct.sku, quantity), crypto.randomUUID())
  }

  async function runStockRace() {
    if (!selectedProduct || selectedProduct.availableQuantity < 1) return
    setRacing(true)
    setNotice('Two distinct checkouts are competing for every currently available unit.')
    const request = currentRequest(selectedProduct.sku, selectedProduct.availableQuantity)
    await Promise.all([
      submitOrder(request, crypto.randomUUID(), false, false),
      submitOrder(request, crypto.randomUUID(), false, false),
    ])
    await refreshState()
    setRacing(false)
  }

  async function restock() {
    if (!selectedProduct || restockAmount < 1) return
    try {
      const response = await fetch(`/api/inventory/${encodeURIComponent(selectedProduct.sku)}/restock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: restockAmount }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.message || 'Restock failed')
      setNotice(`${selectedProduct.sku} restocked by ${restockAmount} units.`)
      await refreshState()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Restock failed')
    }
  }

  function retryEntry(entry: ActivityEntry) {
    void submitOrder(entry.request, entry.key, true)
  }

  const total = selectedProduct ? selectedProduct.unitPriceCents * quantity : 0
  const circuitClass = circuit === 'closed' ? 'is-closed' : circuit === 'open' ? 'is-open' : 'is-waiting'

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Order Desk home">
          <span className="brand-mark"><ShoppingBag size={19} strokeWidth={2.2} /></span>
          <span>order<span className="brand-light">desk</span></span>
        </a>
        <div className="topbar-right">
          <span className={`api-status ${connectionError ? 'is-offline' : ''}`}>
            <span className="status-dot" />{connectionError ? 'API OFFLINE' : 'API CONNECTED'}
          </span>
          <span className={`breaker-status ${circuitClass}`}>
            <ShieldCheck size={15} /> PAYMENT CIRCUIT {circuit.toUpperCase()}
          </span>
        </div>
      </header>

      <section className="page-heading" id="top">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> ORDER PROCESSING LAB</div>
          <h1>Order desk</h1>
          <p className="heading-copy">Checkout, payment, and inventory contention in one live environment.</p>
        </div>
        <button className="icon-button refresh-button" type="button" onClick={() => void refreshState()} title="Refresh inventory" aria-label="Refresh inventory">
          <RefreshCw size={17} />
        </button>
      </section>

      {connectionError && <div className="connection-banner"><AlertTriangle size={17} />{connectionError}</div>}
      {notice && <div className="notice-banner"><Check size={16} />{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss message"><X size={15} /></button></div>}

      <section className="inventory-section" aria-labelledby="inventory-title">
        <div className="section-heading">
          <div>
            <div className="section-kicker">01 / STOCK</div>
            <h2 id="inventory-title">Live inventory</h2>
          </div>
          <span className="sync-label"><span className="sync-dot" /> AUTO-REFRESH 2.5S</span>
        </div>
        <div className="inventory-table-wrap">
          <table className="inventory-table">
            <thead><tr><th>PRODUCT</th><th>SKU</th><th>UNIT PRICE</th><th className="quantity-cell">AVAILABLE</th></tr></thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.sku} className={selectedSku === product.sku ? 'selected-row' : ''} onClick={() => setSelectedSku(product.sku)}>
                  <td><span className="product-icon"><Package size={17} /></span><span className="product-name">{product.name}</span></td>
                  <td className="sku-cell">{product.sku}</td>
                  <td>{money.format(product.unitPriceCents / 100)}</td>
                  <td className="quantity-cell"><span className={`stock-count ${product.availableQuantity < 4 ? 'low-stock' : ''}`}>{product.availableQuantity}</span><span className="stock-unit">units</span></td>
                </tr>
              ))}
              {products.length === 0 && <tr><td className="empty-row" colSpan={4}>Waiting for inventory data…</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="workbench-grid">
        <section className="workbench-panel checkout-panel" aria-labelledby="checkout-title">
          <div className="section-heading panel-heading">
            <div><div className="section-kicker">02 / CHECKOUT</div><h2 id="checkout-title">Create an order</h2></div>
            <span className="step-icon"><CreditCard size={18} /></span>
          </div>

          <label className="field-label" htmlFor="product-select">PRODUCT</label>
          <select id="product-select" value={selectedSku} onChange={(event) => setSelectedSku(event.target.value)}>
            {products.map((product) => <option key={product.sku} value={product.sku}>{product.name} · {product.sku}</option>)}
          </select>

          <div className="quantity-line">
            <label className="field-label" htmlFor="quantity-input">QUANTITY</label>
            <div className="stepper">
              <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease quantity">−</button>
              <input id="quantity-input" type="number" min="1" max="100000" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} />
              <button type="button" onClick={() => setQuantity((value) => value + 1)} aria-label="Increase quantity">+</button>
            </div>
          </div>

          <div className="order-total"><span>ESTIMATED TOTAL</span><strong>{money.format(total / 100)}</strong></div>

          <div className="field-label payment-label">SIMULATED PAYMENT</div>
          <div className="scenario-control" role="group" aria-label="Payment outcome">
            <button type="button" className={scenario === 'success' ? 'active success-choice' : ''} onClick={() => setScenario('success')}><Check size={14} /> Approve</button>
            <button type="button" className={scenario === 'decline' ? 'active decline-choice' : ''} onClick={() => setScenario('decline')}><X size={14} /> Decline</button>
            <button type="button" className={scenario === 'provider-error' ? 'active outage-choice' : ''} onClick={() => setScenario('provider-error')}><ShieldAlert size={14} /> Outage</button>
          </div>

          <div className="delay-control">
            <label className="field-label" htmlFor="delay-range"><span><Clock3 size={14} /> RESPONSE DELAY</span><strong>{(delayMs / 1000).toFixed(1)}s</strong></label>
            <input id="delay-range" type="range" min="0" max="15000" step="500" value={delayMs} onChange={(event) => setDelayMs(Number(event.target.value))} />
            <div className="range-labels"><span>Instant</span><span>15 seconds</span></div>
          </div>

          <button className="primary-button place-order" type="button" onClick={placeOrder} disabled={!selectedProduct || !quantity || !!connectionError}>
            {activeRequests > 0 ? <Activity size={17} className="spin" /> : <Play size={16} fill="currentColor" />}
            Place order
            <span className="button-total">{money.format(total / 100)}</span>
          </button>
          <p className="helper-copy">A fresh idempotency key is generated for each new checkout.</p>
        </section>

        <section className="workbench-panel concurrency-panel" aria-labelledby="concurrency-title">
          <div className="section-heading panel-heading">
            <div><div className="section-kicker">03 / CONTENTION</div><h2 id="concurrency-title">Race for stock</h2></div>
            <span className="step-icon race-icon"><ArrowDownUp size={18} /></span>
          </div>
          <div className="race-readout">
            <div className="race-number">02</div>
            <div><strong>independent checkouts</strong><span>same SKU · separate idempotency keys</span></div>
          </div>
          <div className="race-visual" aria-hidden="true">
            <div className="race-lane"><span className="lane-tag">A</span><span className="lane-track"><i /></span><span className="lane-label">ORDER</span></div>
            <div className="race-lane"><span className="lane-tag lane-b">B</span><span className="lane-track"><i /></span><span className="lane-label">ORDER</span></div>
            <span className="stock-gate"><Package size={17} /><b>{selectedProduct?.availableQuantity ?? '–'}</b></span>
          </div>
          <p className="race-description">Each contender requests all <strong>{selectedProduct?.availableQuantity ?? 0} available units</strong> of {selectedProduct?.sku ?? 'the selected SKU'}. The row lock lets one reserve stock; the other should receive an insufficient-stock conflict.</p>
          <button className="secondary-button race-button" type="button" onClick={() => void runStockRace()} disabled={!selectedProduct?.availableQuantity || racing || !!connectionError}>
            {racing ? <Activity size={16} className="spin" /> : <Zap size={16} />}
            {racing ? 'Contenders running…' : 'Launch two simultaneous orders'}
          </button>
          <div className="restock-row">
            <div><span className="field-label">RESET THE SCENARIO</span><span className="restock-caption">Add stock back for another race.</span></div>
            <div className="restock-actions">
              <input aria-label="Restock quantity" type="number" min="1" max="10000" value={restockAmount} onChange={(event) => setRestockAmount(Math.max(1, Number(event.target.value)))} />
              <button type="button" className="icon-button restock-button" onClick={() => void restock()} disabled={!selectedProduct || !!connectionError} title="Restock selected product" aria-label="Restock selected product"><Plus size={17} /></button>
            </div>
          </div>
          <p className="demo-warning"><AlertTriangle size={14} /> Restock is a demo control; it is disabled in production mode.</p>
        </section>
      </section>

      <section className="activity-section" aria-labelledby="activity-title">
        <div className="section-heading activity-heading">
          <div><div className="section-kicker">04 / REQUESTS</div><h2 id="activity-title">Request activity</h2></div>
          <span className="active-count">{activeRequests} IN FLIGHT</span>
        </div>
        <div className="activity-list">
          {entries.length === 0 && <div className="activity-empty"><Activity size={19} /><span>Order attempts will appear here.</span></div>}
          {entries.map((entry) => (
            <article className="activity-row" key={entry.id}>
              <span className={`result-mark ${entry.result ?? 'pending'}`}>
                {entry.result === 'paid' ? <Check size={15} /> : entry.result === 'conflict' || entry.result === 'payment-failed' || entry.result === 'error' ? <X size={15} /> : <Clock3 size={15} />}
              </span>
              <div className="activity-main">
                <div className="activity-title-line"><strong>{entry.sku}</strong><span>× {entry.quantity}</span>{entry.replay && <em>REPLAY</em>}</div>
                <div className="activity-subline">
                  {entry.order ? <><span>Order {entry.order.id.slice(0, 8)}</span><span>{entry.order.status.replaceAll('_', ' ')}</span></> : <span>{entry.message ?? 'Waiting for payment response…'}</span>}
                  <span>KEY {entry.key.slice(0, 12)}…</span>
                </div>
                {entry.message && entry.order && <div className="payment-message">{entry.message}</div>}
              </div>
              <div className="activity-meta">
                <span>{entry.elapsedMs !== undefined ? `${(entry.elapsedMs / 1000).toFixed(2)}s` : timestamp.format(new Date(entry.startedAt))}</span>
                <button type="button" className="icon-button replay-button" onClick={() => retryEntry(entry)} title="Retry the same request with the same idempotency key" aria-label="Replay request with same key"><RotateCcw size={15} /></button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="footer-note"><span><CircleDollarSign size={14} /> PAYMENT SIMULATOR</span><span><ExternalLink size={13} /> Orders and inventory persist in PostgreSQL</span></footer>
    </main>
  )
}

export default App
