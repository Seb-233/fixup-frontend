import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Charge } from '../../data/models';
import { WorkApi } from '../../data/work.api';
import { CHARGE_STATUS, SPECIALTY, money } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { DayPipe, LabelPipe, MoneyPipe } from '../../shared/ui/pipes';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { StatusComponent } from '../../shared/ui/status.component';
import { PaymentPanelComponent } from './payment-panel.component';

@Component({
  selector: 'app-payments-page',
  imports: [RouterLink, IconComponent, StatusComponent, MoneyPipe, DayPipe, LabelPipe, PaymentPanelComponent, LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>Pagos</h1>
          <p class="lede">Cobros de los trabajos que aceptaste. El técnico recibe su parte cuando el pago está aprobado y el trabajo terminado.</p>
        </div>
        <div class="actions">
          <a routerLink="/expenses" class="btn btn-secondary"><app-icon name="chart" />Reporte de gastos</a>
        </div>
      </header>

      @if (charges.isLoading() && !charges.hasValue()) {
        <app-loading text="Cargando pagos…" />
      } @else if (charges.error()) {
        <app-error (retry)="charges.reload()" />
      } @else if (charges.hasValue() && charges.value().length) {
        <dl class="facts panel">
          <div><dt>Por pagar</dt><dd>{{ pendingTotal() }}</dd></div>
          <div><dt>Pagado</dt><dd>{{ paidTotal() }}</dd></div>
          <div><dt>Cobros</dt><dd>{{ charges.value().length }}</dd></div>
        </dl>

        <div class="split">
          <div class="panel table-panel">
            <table class="table">
              <thead><tr><th scope="col">Trabajo</th><th scope="col">Fecha</th><th scope="col" class="num">Valor</th><th scope="col">Estado</th><th scope="col"><span class="visually-hidden">Acción</span></th></tr></thead>
              <tbody>
                @for (c of sorted(); track c.id) {
                  <tr [class.selected]="selected()?.id === c.id">
                    <td data-label="Trabajo">
                      <div class="stack-sm">
                        <a [routerLink]="['/requests', c.requestId]" class="link">{{ c.concept || 'Trabajo' }}</a>
                        <span class="text-xs text-muted">{{ c.specialty | label: specialty }} · {{ c.reference }}</span>
                      </div>
                    </td>
                    <td data-label="Fecha">{{ (c.approvedAt || c.createdAt) | day }}</td>
                    <td data-label="Valor" class="num">{{ c.amount | money }}</td>
                    <td data-label="Estado"><app-status [map]="status" [value]="c.status" /></td>
                    <td data-label="Acción">
                      @if (c.status !== 'APPROVED') {
                        <button type="button" class="btn btn-secondary" (click)="selected.set(c)">Pagar</button>
                      } @else {
                        <button type="button" class="btn btn-ghost" (click)="selected.set(c)">Detalle</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <aside class="sticky-aside">
            @if (selected(); as c) {
              <app-payment-panel [charge]="c" [canPay]="true" (paid)="onPaid($event)" />
            } @else {
              <div class="panel panel-quiet stack-sm">
                <h2 class="text-lg">Elige un cobro</h2>
                <p class="text-sm">Selecciona un cobro de la lista para ver su detalle o pagarlo en la pasarela de prueba.</p>
              </div>
            }
          </aside>
        </div>
      } @else {
        <app-empty title="No tienes cobros" text="Cuando aceptes la cotización de un técnico se genera el cobro del trabajo." />
      }
    </div>
  `,
  styles: `.table-panel { padding: var(--s-2) var(--s-4); } tr.selected td { background: var(--surface-2); }`
})
export class PaymentsPage {
  private readonly api = inject(WorkApi);
  readonly charges = rxResource({ stream: () => this.api.myCharges() });
  readonly selected = signal<Charge | null>(null);
  readonly status = CHARGE_STATUS;
  readonly specialty = SPECIALTY;

  readonly sorted = computed(() => {
    if (!this.charges.hasValue()) return [];
    const rank = (c: Charge) => (c.status === 'APPROVED' ? 1 : 0);
    return [...this.charges.value()].sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt));
  });
  readonly pendingTotal = computed(() => money(this.sum((c) => c.status !== 'APPROVED')));
  readonly paidTotal = computed(() => money(this.sum((c) => c.status === 'APPROVED')));

  onPaid(charge: Charge): void {
    this.selected.set(charge);
    this.charges.update((list) => (list ?? []).map((c) => (c.id === charge.id ? charge : c)));
  }

  private sum(filter: (c: Charge) => boolean): number {
    return this.charges.hasValue() ? this.charges.value().filter(filter).reduce((total, c) => total + c.amount, 0) : 0;
  }
}
