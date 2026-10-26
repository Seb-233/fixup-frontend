import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { WorkApi } from '../../data/work.api';
import { EARNING_STATUS, PAYOUT_STATUS, errorMessage, generateUuid, money } from '../../shared/format';
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
          <p class="lede">Cada trabajo queda retenido (HELD) hasta que el cliente paga y tú lo terminas; ahí pasa a disponible (AVAILABLE) para retiro digital simulado.</p>
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
              <div><dt>Disponible para retirar (AVAILABLE)</dt><dd class="price">{{ e.availableBalance | money }}</dd></div>
              <div><dt>Retenido (HELD)</dt><dd>{{ e.heldBalance | money }}</dd></div>
              <div><dt>Ya retirado (PAID_OUT)</dt><dd>{{ e.paidOutTotal | money }}</dd></div>
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
                          <td data-label="Fecha">{{ (h.releasedAt || h.createdAt) | day }}</td>
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
              <p class="text-sm text-muted">Retiro digital simulado: simulación académica sin conexión bancaria real. Se transfiere únicamente el saldo disponible.</p>
              @if (e.heldBalance > 0 && e.availableBalance <= 0) {
                <p class="text-xs text-muted">Tienes saldo retenido ({{ e.heldBalance | money }}), el cual no puede retirarse hasta que los trabajos concluyan y se aprueben.</p>
              }
              @if (message()) { <div class="alert" [class.alert-success]="!messageIsError()" [class.alert-danger]="messageIsError()" role="status">{{ message() }}</div> }
              <button type="button" class="btn btn-primary" (click)="requestPayout()" [disabled]="busy() || e.availableBalance <= 0">
                Retirar {{ e.availableBalance | money }}
              </button>
            </div>
            @if (payouts.hasValue() && payouts.value().length) {
              <div class="panel stack-sm">
                <h2 class="text-lg">Retiros digitales simulados</h2>
                <ul class="list">
                  @for (p of payouts.value(); track p.id) {
                    <li class="payout stack-sm">
                      <div class="spread">
                        <span class="stack-sm">
                          <strong>{{ p.amount | money }}</strong>
                          <span class="text-xs text-muted">{{ p.earningCount }} {{ p.earningCount === 1 ? 'trabajo' : 'trabajos' }} · {{ (p.transferredAt || p.requestedAt) | day }}</span>
                        </span>
                        <app-status [map]="payoutStatus" [value]="p.status" />
                      </div>
                      @if (p.detailStatus === 'LEGACY_UNAVAILABLE') {
                        <p class="text-xs text-muted">El desglose histórico no se puede reconstruir (operación previa).</p>
                      } @else if (p.earnings && p.earnings.length) {
                        <div class="text-xs text-muted">
                          <span>Detalle de ingresos asociados:</span>
                          @for (entry of p.earnings; track entry.earningId) {
                            <span> · {{ entry.netAmount | money }}</span>
                          }
                        </div>
                      }
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
  styles: `.table-panel { padding: var(--s-2) var(--s-4); } .payout { padding: var(--s-2) 0; border-bottom: 1px solid var(--border); }`
})
export class EarningsPage {
  private readonly api = inject(WorkApi);
  private readonly user = inject(CurrentUserStore);

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

  private getStorageKey(): string {
    const userId = this.user.user()?.id ?? 'anonymous';
    return `fixup_in_flight_payout_${userId}`;
  }

  getInFlightKey(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return sessionStorage.getItem(this.getStorageKey());
    } catch {
      return null;
    }
  }

  requestPayout(forceNewKey = false): void {
    if (this.busy()) return;
    const available = this.earnings.value()?.availableBalance ?? 0;
    if (available <= 0) return;

    this.busy.set(true);
    this.message.set(null);

    let key = this.getInFlightKey();
    if (!key || forceNewKey) {
      key = generateUuid();
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(this.getStorageKey(), key);
        } catch {
          // ignore
        }
      }
    }

    this.api.requestPayout(key).subscribe({
      next: (payout) => {
        this.busy.set(false);
        this.messageIsError.set(false);
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.removeItem(this.getStorageKey());
          } catch {
            // ignore
          }
        }
        this.message.set(`Retiro digital simulado exitoso por ${money(payout.amount)} (simulación académica, sin movimientos bancarios reales).`);
        this.earnings.reload();
        this.payouts.reload();
      },
      error: (failure) => {
        this.busy.set(false);
        this.messageIsError.set(true);
        // Ante fallo no de red, liberamos la clave para una nueva intención
        if (failure?.status !== 0) {
          if (typeof window !== 'undefined') {
            try {
              sessionStorage.removeItem(this.getStorageKey());
            } catch {
              // ignore
            }
          }
        }
        this.message.set(errorMessage(failure, 'No pudimos solicitar el retiro simulado.'));
      }
    });
  }
}
