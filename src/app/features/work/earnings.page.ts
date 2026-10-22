import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { WorkApi } from '../../data/work.api';
import { EARNING_STATUS, PAYOUT_STATUS, errorMessage } from '../../shared/format';
import { DayPipe, MoneyPipe } from '../../shared/ui/pipes';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { StatusComponent } from '../../shared/ui/status.component';

@Component({
  selector: 'app-earnings-page',
  imports: [StatusComponent, MoneyPipe, DayPipe, LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>Mis ingresos</h1>
          <p class="lede">Cada trabajo queda retenido hasta que el cliente paga y tú lo terminas; ahí pasa a disponible y lo puedes retirar.</p>
        </div>
      </header>

      @if (earnings.isLoading() && !earnings.hasValue()) {
        <app-loading text="Calculando tu saldo…" />
      } @else if (earnings.error()) {
        <app-error (retry)="earnings.reload()" />
      } @else if (earnings.hasValue()) {
        @let e = earnings.value();
        <div class="split">
          <div class="stack">
            <dl class="facts panel">
              <div><dt>Disponible para retirar</dt><dd class="price">{{ e.availableBalance | money }}</dd></div>
              <div><dt>Retenido</dt><dd>{{ e.heldBalance | money }}</dd></div>
              <div><dt>Ya retirado</dt><dd>{{ e.paidOutTotal | money }}</dd></div>
              <div><dt>Comisión Fix&amp;Rent</dt><dd>{{ e.totalCommission | money }}</dd></div>
            </dl>

            <section class="stack-sm" aria-labelledby="history-title">
              <h2 id="history-title">Historial por trabajo</h2>
              @if (e.history.length) {
                <div class="panel table-panel">
                  <table class="table">
                    <thead><tr><th scope="col">Fecha</th><th scope="col" class="num">Valor cobrado</th><th scope="col" class="num">Comisión</th><th scope="col" class="num">Para ti</th><th scope="col">Estado</th></tr></thead>
                    <tbody>
                      @for (h of history(); track h.id) {
                        <tr>
                          <td data-label="Fecha">{{ (h.jobCompletedAt || h.createdAt) | day }}</td>
                          <td data-label="Valor cobrado" class="num">{{ h.grossAmount | money }}</td>
                          <td data-label="Comisión" class="num">{{ h.commissionAmount | money }} ({{ h.commissionRateBasisPoints / 100 }} %)</td>
                          <td data-label="Para ti" class="num"><strong>{{ h.netAmount | money }}</strong></td>
                          <td data-label="Estado"><app-status [map]="status" [value]="h.status" /></td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <app-empty title="Aún no tienes ingresos" text="Tus ingresos aparecen cuando un cliente acepta una de tus cotizaciones." />
              }
            </section>
          </div>

          <aside class="stack sticky-aside">
            <div class="panel stack-sm">
              <h2 class="text-lg">Retirar saldo</h2>
              <p class="text-sm text-muted">Se transfiere todo lo disponible de una vez (simulado: no se llama a ningún banco).</p>
              @if (message()) { <div class="alert" [class.alert-success]="!messageIsError()" [class.alert-danger]="messageIsError()" role="status">{{ message() }}</div> }
              <button type="button" class="btn btn-primary" (click)="requestPayout()" [disabled]="busy() || e.availableBalance <= 0">
                Retirar {{ e.availableBalance | money }}
              </button>
            </div>
            @if (payouts.hasValue() && payouts.value().length) {
              <div class="panel stack-sm">
                <h2 class="text-lg">Retiros</h2>
                <ul class="list">
                  @for (p of payouts.value(); track p.id) {
                    <li class="spread payout">
                      <span class="stack-sm"><strong>{{ p.amount | money }}</strong><span class="text-xs text-muted">{{ p.earningCount }} trabajos · {{ (p.transferredAt || p.requestedAt) | day }}</span></span>
                      <app-status [map]="payoutStatus" [value]="p.status" />
                    </li>
                  }
                </ul>
              </div>
            }
          </aside>
        </div>
      }
    </div>
  `,
  styles: `.table-panel { padding: var(--s-2) var(--s-4); } .payout { padding: var(--s-2) 0; }`
})
export class EarningsPage {
  private readonly api = inject(WorkApi);
  readonly earnings = rxResource({ stream: () => this.api.earnings() });
  readonly payouts = rxResource({ stream: () => this.api.payouts() });
  readonly status = EARNING_STATUS;
  readonly payoutStatus = PAYOUT_STATUS;
  readonly busy = signal(false);
  readonly message = signal<string | null>(null);
  readonly messageIsError = signal(false);

  readonly history = computed(() =>
    this.earnings.hasValue() ? [...this.earnings.value().history].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []
  );

  requestPayout(): void {
    this.busy.set(true);
    this.message.set(null);
    this.api.requestPayout().subscribe({
      next: (payout) => {
        this.busy.set(false);
        this.messageIsError.set(false);
        this.message.set(`Transferimos ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(payout.amount)} a tu cuenta.`);
        this.earnings.reload();
        this.payouts.reload();
      },
      error: (failure) => {
        this.busy.set(false);
        this.messageIsError.set(true);
        this.message.set(errorMessage(failure, 'No pudimos solicitar el retiro.'));
      }
    });
  }
}
