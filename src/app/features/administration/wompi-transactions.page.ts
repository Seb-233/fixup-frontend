import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { WompiTransactionView } from '../../data/models';
import { WorkApi } from '../../data/work.api';
import {
  PAYMENT_PURPOSE,
  PAYMENT_STATUS,
  WOMPI_PAYMENT_METHOD,
  WOMPI_RECONCILIATION,
  WOMPI_RECONCILIATION_HINT,
  WOMPI_TRANSACTION_STATUS,
  errorMessage,
  money
} from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { LabelPipe, WhenPipe } from '../../shared/ui/pipes';
import { EmptyStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { StatusComponent } from '../../shared/ui/status.component';

interface Filter {
  from: string;
  until: string;
  status: string;
  page: number;
}

const PAGE_SIZE = 20;
const ATTENTION = new Set(['DUPLICATE', 'AMOUNT_MISMATCH']);

// INT-01: transacciones del comercio en Wompi, leídas en vivo con la llave privada y cruzadas con los
// pagos de FixUp. Sirve para ver los pagos de prueba sin entrar al panel de Wompi y para encontrar
// pagos aprobados que FixUp no registró o cobros dobles. Los datos del comprador no salen de Wompi.
@Component({
  selector: 'app-wompi-transactions-page',
  imports: [FormsModule, IconComponent, StatusComponent, LabelPipe, WhenPipe, LoadingComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>Transacciones Wompi</h1>
          <p class="lede">
            Transacciones del comercio consultadas en vivo a Wompi
            @if (list.hasValue()) { ({{ list.value().environment === 'sandbox' ? 'ambiente de pruebas' : 'producción' }}) }
            y cruzadas con los pagos de FixUp. Los datos del comprador se quedan en Wompi.
          </p>
        </div>
        <div class="actions"><button type="button" class="btn btn-ghost" (click)="list.reload()"><app-icon name="refresh" />Actualizar</button></div>
      </header>

      <form class="panel filters" (ngSubmit)="search()">
        <div class="field">
          <label for="wompi-from">Desde</label>
          <input id="wompi-from" class="input" type="date" name="from" [(ngModel)]="from" />
        </div>
        <div class="field">
          <label for="wompi-until">Hasta</label>
          <input id="wompi-until" class="input" type="date" name="until" [(ngModel)]="until" />
        </div>
        <div class="field">
          <label for="wompi-status">Estado en Wompi</label>
          <select id="wompi-status" class="select" name="status" [(ngModel)]="status">
            @for (option of statusOptions; track option.value) { <option [value]="option.value">{{ option.label }}</option> }
          </select>
        </div>
        <button type="submit" class="btn btn-primary"><app-icon name="search" />Consultar</button>
      </form>

      @if (list.isLoading() && !list.hasValue()) {
        <app-loading text="Consultando a Wompi…" />
      } @else if (list.error()) {
        <div class="alert alert-danger" role="alert">
          <app-icon name="alert" />
          <span>{{ failure() }}</span>
          <button type="button" class="btn btn-ghost" (click)="list.reload()">Reintentar</button>
        </div>
      } @else if (list.hasValue()) {
        <div class="summary" aria-live="polite">
          <div class="panel stat"><span class="stat-label">Transacciones en el rango</span><strong>{{ list.value().totalResults }}</strong></div>
          <div class="panel stat"><span class="stat-label">Aprobadas en esta página</span><strong>{{ approved().count }}</strong><span class="text-xs text-muted">{{ approved().total }}</span></div>
          <div class="panel stat" [class.stat-warning]="attention() > 0"><span class="stat-label">Para revisar</span><strong>{{ attention() }}</strong><span class="text-xs text-muted">sin registrar, cobro doble o monto distinto</span></div>
        </div>

        @if (list.value().items.length) {
          <div class="panel table-panel">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Transacción</th>
                  <th scope="col">Pago en FixUp</th>
                  <th scope="col" class="num">Valor</th>
                  <th scope="col">Wompi</th>
                  <th scope="col">FixUp</th>
                </tr>
              </thead>
              <tbody>
                @for (tx of list.value().items; track tx.transactionId) {
                  <tr>
                    <td data-label="Fecha">{{ tx.createdAt | when }}</td>
                    <td data-label="Transacción">
                      <div class="stack-sm">
                        <span class="mono">{{ tx.transactionId }}</span>
                        <span class="text-xs text-muted">{{ tx.paymentMethodType | label: methods }}</span>
                      </div>
                    </td>
                    <td data-label="Pago en FixUp">
                      @if (tx.paymentId) {
                        <div class="stack-sm">
                          <span class="mono">{{ tx.paymentReference }}</span>
                          <span class="text-xs text-muted">{{ tx.paymentPurpose | label: purposes }} · <app-status [map]="paymentStatus" [value]="tx.paymentStatus" /></span>
                        </div>
                      } @else {
                        <span class="mono text-muted">{{ tx.reference }}</span>
                      }
                    </td>
                    <td data-label="Valor" class="num">{{ amount(tx) }}</td>
                    <td data-label="Wompi">
                      <app-status [map]="wompiStatus" [value]="tx.status" />
                      @if (tx.statusMessage) { <div class="text-xs text-muted">{{ tx.statusMessage }}</div> }
                    </td>
                    <td data-label="FixUp" [title]="hint(tx)">
                      <app-status [map]="reconciliation" [value]="tx.reconciliation" />
                      @if (needsAttention(tx)) { <div class="text-xs text-muted hint">{{ hint(tx) }}</div> }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (pages() > 1) {
            <nav class="pager" aria-label="Páginas de transacciones">
              <button type="button" class="btn btn-ghost" [disabled]="filter().page <= 1" (click)="go(filter().page - 1)"><app-icon name="chevron-left" />Anterior</button>
              <span class="text-sm">Página {{ filter().page }} de {{ pages() }}</span>
              <button type="button" class="btn btn-ghost" [disabled]="filter().page >= pages()" (click)="go(filter().page + 1)">Siguiente<app-icon name="chevron-right" /></button>
            </nav>
          }
        } @else {
          <app-empty title="Sin transacciones" text="Wompi no tiene transacciones con ese estado en el rango elegido." />
        }
      }
    </div>
  `,
  styles: `
    .filters { display: flex; flex-wrap: wrap; gap: var(--s-3); align-items: flex-end; padding: var(--s-4); margin-bottom: var(--s-4); }
    .filters .field { flex: 1 1 160px; margin: 0; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--s-3); margin-bottom: var(--s-4); }
    .stat { display: flex; flex-direction: column; gap: var(--s-1); padding: var(--s-3) var(--s-4); }
    .stat strong { font-size: 1.5rem; }
    .stat-label { font-size: 0.8125rem; color: var(--text-muted); }
    .stat-warning strong { color: var(--warning); }
    .table-panel { padding: var(--s-2) var(--s-4); overflow-x: auto; }
    .mono { font-family: var(--font-mono, ui-monospace, monospace); font-size: 0.8125rem; overflow-wrap: anywhere; }
    .num { text-align: right; white-space: nowrap; }
    .hint { max-width: 28ch; }
    .pager { display: flex; align-items: center; justify-content: center; gap: var(--s-3); margin-top: var(--s-3); }
  `
})
export class WompiTransactionsPage {
  private readonly api = inject(WorkApi);

  readonly wompiStatus = WOMPI_TRANSACTION_STATUS;
  readonly reconciliation = WOMPI_RECONCILIATION;
  readonly paymentStatus = PAYMENT_STATUS;
  readonly methods = WOMPI_PAYMENT_METHOD;
  readonly purposes = PAYMENT_PURPOSE;
  readonly statusOptions = [
    { value: 'APPROVED', label: 'Aprobadas' },
    { value: 'ALL', label: 'Todas' },
    { value: 'PENDING', label: 'Pendientes' },
    { value: 'DECLINED', label: 'Rechazadas' },
    { value: 'VOIDED', label: 'Anuladas' },
    { value: 'ERROR', label: 'Con error' }
  ];

  // El rango por omisión (últimos 30 días) lo decide el backend; los campos se llenan con lo que devuelve.
  from = '';
  until = '';
  status = 'APPROVED';
  readonly filter = signal<Filter>({ from: '', until: '', status: 'APPROVED', page: 1 });

  readonly list = rxResource({
    params: () => this.filter(),
    stream: ({ params }) =>
      this.api.wompiTransactions({
        from: params.from || undefined,
        until: params.until || undefined,
        status: params.status,
        page: params.page,
        size: PAGE_SIZE
      })
  });

  readonly failure = computed(() => errorMessage(this.list.error(), 'Wompi no respondió. Intenta de nuevo en un momento.'));

  readonly approved = computed(() => {
    const items = this.list.hasValue() ? this.list.value().items.filter((tx) => tx.status === 'APPROVED') : [];
    const cents = items.reduce((sum, tx) => sum + Number(tx.amountInCents), 0);
    return { count: items.length, total: money(cents / 100) };
  });

  readonly attention = computed(() =>
    this.list.hasValue() ? this.list.value().items.filter((tx) => this.needsAttention(tx)).length : 0
  );

  readonly pages = computed(() =>
    this.list.hasValue() ? Math.max(1, Math.ceil(this.list.value().totalResults / PAGE_SIZE)) : 1
  );

  constructor() {
    effect(() => {
      if (this.list.hasValue() && !this.from && !this.until) {
        this.from = this.list.value().from;
        this.until = this.list.value().until;
      }
    });
  }

  search(): void {
    this.filter.set({ from: this.from, until: this.until, status: this.status, page: 1 });
  }

  go(page: number): void {
    this.filter.update((current) => ({ ...current, page }));
  }

  amount(tx: WompiTransactionView): string {
    return tx.currency === 'COP' ? money(Number(tx.amountInCents) / 100) : `${Number(tx.amountInCents) / 100} ${tx.currency}`;
  }

  hint(tx: WompiTransactionView): string {
    return WOMPI_RECONCILIATION_HINT[tx.reconciliation] ?? '';
  }

  needsAttention(tx: WompiTransactionView): boolean {
    return ATTENTION.has(tx.reconciliation) || (tx.reconciliation === 'NOT_RECORDED' && tx.status === 'APPROVED');
  }
}
