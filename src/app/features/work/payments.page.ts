import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { OwnerDebtDetail, PaymentDetail } from '../../data/models';
import { WorkApi } from '../../data/work.api';
import { PAYMENT_PURPOSE, PAYMENT_STATUS, errorMessage, money } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { DayPipe, LabelPipe, MoneyPipe } from '../../shared/ui/pipes';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { StatusComponent } from '../../shared/ui/status.component';
import { PaymentPanelComponent } from './payment-panel.component';

// FR-UC-05: los pagos por transferencia del propietario (o de la inmobiliaria que administra el
// inmueble) y los saldos que quedaron pendientes de trabajos pagados en efectivo.
@Component({
  selector: 'app-payments-page',
  imports: [RouterLink, IconComponent, StatusComponent, MoneyPipe, DayPipe, LabelPipe, PaymentPanelComponent, LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>Pagos</h1>
          <p class="lede">Los trabajos por transferencia se pagan en la pasarela de prueba y el técnico los empieza cuando el pago queda aprobado. Los de efectivo se liquidan con el técnico al terminar.</p>
        </div>
        <div class="actions">
          <a routerLink="/expenses" class="btn btn-secondary"><app-icon name="chart" />Reporte de gastos</a>
        </div>
      </header>

      @if (outstanding().length) {
        <section class="panel stack" aria-labelledby="debts-title">
          <div class="spread">
            <h2 id="debts-title" class="text-lg">Saldos pendientes de trabajos en efectivo</h2>
            <span class="price">{{ debtTotal() }}</span>
          </div>
          <p class="text-sm">Mientras tengas un saldo pendiente no puedes abrir otra solicitud.</p>
          <ul class="stack-sm" role="list">
            @for (d of outstanding(); track d.debtId) {
              <li class="spread">
                <span>
                  <a [routerLink]="['/requests', d.requestId]" class="link">Trabajo del {{ d.createdAt | day }}</a>
                  · {{ d.amount | money }}
                </span>
                <button type="button" class="btn btn-primary" [disabled]="paying() === d.debtId" (click)="payDebt(d)">
                  {{ paying() === d.debtId ? 'Preparando…' : 'Pagar saldo' }}
                </button>
              </li>
            }
          </ul>
          @if (debtError()) { <div class="alert alert-danger" role="alert">{{ debtError() }}</div> }
        </section>
      }

      @if (payments.isLoading() && !payments.hasValue()) {
        <app-loading text="Cargando pagos…" />
      } @else if (payments.error()) {
        <app-error (retry)="payments.reload()" />
      } @else if (payments.hasValue() && payments.value().length) {
        <dl class="facts panel">
          <div><dt>Por pagar</dt><dd>{{ pendingTotal() }}</dd></div>
          <div><dt>Pagado</dt><dd>{{ paidTotal() }}</dd></div>
          <div><dt>Pagos</dt><dd>{{ payments.value().length }}</dd></div>
        </dl>

        <div class="split">
          <div class="panel table-panel">
            <table class="table">
              <thead><tr><th scope="col">Concepto</th><th scope="col">Fecha</th><th scope="col" class="num">Valor</th><th scope="col">Estado</th><th scope="col"><span class="visually-hidden">Acción</span></th></tr></thead>
              <tbody>
                @for (p of sorted(); track p.paymentId) {
                  <tr [class.selected]="selected()?.paymentId === p.paymentId">
                    <td data-label="Concepto">
                      <a [routerLink]="['/requests', p.requestId]" class="link">{{ p.purpose | label: purposes }}</a>
                    </td>
                    <td data-label="Fecha">{{ (p.completedAt || p.createdAt) | day }}</td>
                    <td data-label="Valor" class="num">{{ p.amount | money }}</td>
                    <td data-label="Estado"><app-status [map]="status" [value]="p.status" /></td>
                    <td data-label="Acción">
                      @if (p.status !== 'APPROVED') {
                        <button type="button" class="btn btn-secondary" (click)="selected.set(p)">Pagar</button>
                      } @else {
                        <button type="button" class="btn btn-ghost" (click)="selected.set(p)">Detalle</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <aside class="sticky-aside">
            @if (selected(); as p) {
              <app-payment-panel [payment]="p" [canPay]="true" (paid)="onPaid($event)" />
            } @else {
              <div class="panel panel-quiet stack-sm">
                <h2 class="text-lg">Elige un pago</h2>
                <p class="text-sm">Selecciona un pago de la lista para ver su detalle o completarlo en la pasarela de prueba.</p>
              </div>
            }
          </aside>
        </div>
      } @else {
        <app-empty title="No tienes pagos" text="Cuando aceptes por transferencia la cotización de un técnico, el pago aparece aquí." />
      }
    </div>
  `,
  styles: `.table-panel { padding: var(--s-2) var(--s-4); } tr.selected td { background: var(--surface-2); }`
})
export class PaymentsPage {
  private readonly api = inject(WorkApi);
  private readonly router = inject(Router);

  readonly payments = rxResource({ stream: () => this.api.myPayments() });
  readonly debts = rxResource({ stream: () => this.api.myDebts().pipe(catchError(() => of<OwnerDebtDetail[]>([]))) });
  readonly selected = signal<PaymentDetail | null>(null);
  readonly paying = signal<string | null>(null);
  readonly debtError = signal<string | null>(null);
  readonly status = PAYMENT_STATUS;
  readonly purposes = PAYMENT_PURPOSE;

  readonly outstanding = computed(() =>
    this.debts.hasValue() ? this.debts.value().filter((d) => d.status === 'OUTSTANDING') : []
  );
  readonly debtTotal = computed(() => money(this.outstanding().reduce((total, d) => total + (d.amount ?? 0), 0)));
  readonly sorted = computed(() => {
    if (!this.payments.hasValue()) return [];
    const rank = (p: PaymentDetail) => (p.status === 'APPROVED' ? 1 : 0);
    return [...this.payments.value()].sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt));
  });
  readonly pendingTotal = computed(() => money(this.sum((p) => p.status !== 'APPROVED')));
  readonly paidTotal = computed(() => money(this.sum((p) => p.status === 'APPROVED')));

  onPaid(payment: PaymentDetail): void {
    this.selected.set(payment);
    this.payments.update((list) => (list ?? []).map((p) => (p.paymentId === payment.paymentId ? payment : p)));
  }

  /** El saldo se paga como una transferencia más: se abre (o se retoma) su pago y se va a la pasarela. */
  payDebt(debt: OwnerDebtDetail): void {
    if (!debt.debtId) return;
    this.paying.set(debt.debtId);
    this.debtError.set(null);
    this.api.payDebt(debt.debtId).subscribe({
      next: (payment) => {
        this.paying.set(null);
        void this.router.navigate(['/payments', payment.paymentId]);
      },
      error: (failure) => {
        this.paying.set(null);
        this.debtError.set(errorMessage(failure, 'No pudimos preparar el pago del saldo.'));
      }
    });
  }

  private sum(filter: (p: PaymentDetail) => boolean): number {
    return this.payments.hasValue() ? this.payments.value().filter(filter).reduce((total, p) => total + p.amount, 0) : 0;
  }
}
