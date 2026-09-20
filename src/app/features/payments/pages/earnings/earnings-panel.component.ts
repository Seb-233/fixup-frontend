import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  EarningStatus,
  EarningsResponse,
  PaymentControllerService,
  PayoutResponse
} from '../../../../api/generated';
import { commissionPercent, earningStatusLabel } from '../../utils/earnings-ui.helpers';

/**
 * FR-UC-20: panel de ingresos del técnico.
 *
 * La comisión se muestra como cifra propia y no como la diferencia entre dos números que el
 * técnico tendría que restar. El monto de la transferencia no se pide: se transfiere el saldo
 * disponible completo, que el backend calcula.
 */
@Component({
  selector: 'app-earnings-panel',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="earnings">
      <header>
        <h1 class="title">Mis ingresos</h1>
        <p class="subtitle">
          El dinero se compromete cuando aceptan tu cotización y se libera cuando cierras el
          trabajo. Montos en pesos colombianos.
        </p>
        <a class="link" routerLink="/jobs/me">Ver mis trabajos →</a>
      </header>

      @if (loading()) {
        <p class="state">Cargando tu saldo…</p>
      } @else if (loadError()) {
        <p class="state error">{{ loadError() }}</p>
      } @else if (summary(); as data) {
        <div class="tiles">
          <article class="tile available">
            <span class="label">Disponible para transferir</span>
            <strong class="value">{{ data.availableBalance | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</strong>
          </article>
          <article class="tile held">
            <span class="label">Retenido en trabajos abiertos</span>
            <strong class="value">{{ data.heldBalance | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</strong>
          </article>
          <article class="tile commission">
            <span class="label">Comisión de la plataforma</span>
            <strong class="value">{{ data.totalCommission | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</strong>
            <span class="hint">sobre {{ data.grossTotal | currency: 'COP' : 'symbol-narrow' : '1.0-0' }} facturados</span>
          </article>
          <article class="tile paid">
            <span class="label">Ya transferido</span>
            <strong class="value">{{ data.paidOutTotal | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</strong>
          </article>
        </div>

        <div class="payout-box">
          @if (payoutError()) {
            <p class="state error">{{ payoutError() }}</p>
          }
          @if (lastPayout(); as payout) {
            <p class="state ok">
              Solicitaste {{ payout.amount | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
              sobre {{ payout.earningCount }} servicio(s).
            </p>
          }
          <button
            type="button"
            class="primary payout-btn"
            [disabled]="requesting() || data.availableBalance === 0"
            (click)="requestPayout()"
          >
            {{ requesting() ? 'Solicitando…' : 'Solicitar transferencia del saldo disponible' }}
          </button>
          @if (data.availableBalance === 0) {
            <p class="hint">
              No tienes saldo disponible. Cierra un trabajo para liberar lo que está retenido.
            </p>
          }
        </div>

        <h2 class="group">Historial de servicios</h2>
        @if (data.history.length === 0) {
          <p class="state">Todavía no has cobrado ningún servicio.</p>
        } @else {
          <ul class="list">
            @for (line of data.history; track line.id) {
              <li class="row">
                <div class="row-head">
                  <span class="status" [class]="line.status.toLowerCase()">
                    {{ statusLabel(line.status) }}
                  </span>
                  <strong class="net">{{ line.netAmount | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</strong>
                </div>
                <p class="breakdown">
                  Bruto {{ line.grossAmount | currency: 'COP' : 'symbol-narrow' : '1.0-0' }} ·
                  comisión {{ line.commissionAmount | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
                  ({{ percent(line.commissionRateBasisPoints) }}%)
                </p>
                <p class="timeline">
                  Retenido el {{ line.createdAt | date: 'dd/MM/yyyy' }}
                  @if (line.releasedAt) {
                    · liberado el {{ line.releasedAt | date: 'dd/MM/yyyy' }}
                  }
                  @if (line.paidOutAt) {
                    · transferido el {{ line.paidOutAt | date: 'dd/MM/yyyy' }}
                  }
                </p>
              </li>
            }
          </ul>
        }

        <h2 class="group">Transferencias solicitadas</h2>
        @if (payouts().length === 0) {
          <p class="state">Todavía no has solicitado ninguna transferencia.</p>
        } @else {
          <ul class="list">
            @for (payout of payouts(); track payout.id) {
              <li class="row">
                <div class="row-head">
                  <span class="status requested">Solicitada</span>
                  <strong class="net">{{ payout.amount | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</strong>
                </div>
                <p class="timeline">
                  {{ payout.requestedAt | date: 'dd/MM/yyyy' }} · {{ payout.earningCount }} servicio(s)
                </p>
              </li>
            }
          </ul>
        }
      }
    </section>
  `,
  styles: [
    `
      .earnings {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        padding: 1.5rem;
      }
      .title {
        margin: 0;
        font-size: 1.5rem;
      }
      .subtitle {
        margin: 0.25rem 0 0;
        max-width: 60ch;
        color: var(--fixup-text-muted, #5b6472);
      }
      .tiles {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
        gap: 0.75rem;
      }
      .tile {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 1rem;
        border: 1px solid var(--fixup-border, #d8dee9);
        border-radius: 0.75rem;
        background: var(--fixup-surface, #fff);
      }
      .tile.available {
        border-color: #1c6b34;
      }
      .label {
        font-size: 0.85rem;
        color: var(--fixup-text-muted, #5b6472);
      }
      .value {
        font-size: 1.35rem;
      }
      .hint {
        font-size: 0.8rem;
        color: var(--fixup-text-muted, #5b6472);
      }
      .payout-box {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        align-items: flex-start;
      }
      .group {
        margin: 1rem 0 0;
        font-size: 1rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--fixup-text-muted, #5b6472);
      }
      .list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .row {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 0.75rem 1rem;
        border: 1px solid var(--fixup-border, #d8dee9);
        border-radius: 0.65rem;
        background: var(--fixup-surface, #fff);
      }
      .row-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
      }
      .status {
        padding: 0.15rem 0.6rem;
        border-radius: 999px;
        font-size: 0.8rem;
        font-weight: 600;
      }
      .status.held {
        background: #fff4d6;
        color: #7a5800;
      }
      .status.available {
        background: #e2f5e7;
        color: #1c6b34;
      }
      .status.paid_out,
      .status.requested {
        background: #e8ecf5;
        color: #33415c;
      }
      .breakdown,
      .timeline {
        margin: 0;
        font-size: 0.85rem;
        color: var(--fixup-text-muted, #5b6472);
      }
      .primary {
        padding: 0.5rem 1rem;
        border: none;
        border-radius: 0.5rem;
        background: var(--fixup-accent, #1d4ed8);
        color: #fff;
        font-weight: 600;
        cursor: pointer;
      }
      .primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .state {
        max-width: 60ch;
        color: var(--fixup-text-muted, #5b6472);
      }
      .state.error {
        color: #b3261e;
      }
      .state.ok {
        color: #1c6b34;
      }
      .link {
        color: var(--fixup-accent, #1d4ed8);
        text-decoration: none;
        font-size: 0.9rem;
      }
    `
  ]
})
export class EarningsPanelComponent implements OnInit {
  private readonly paymentsApi = inject(PaymentControllerService);

  readonly summary = signal<EarningsResponse | null>(null);
  readonly payouts = signal<PayoutResponse[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly requesting = signal(false);
  readonly payoutError = signal<string | null>(null);
  readonly lastPayout = signal<PayoutResponse | null>(null);

  ngOnInit(): void {
    this.load();
  }

  statusLabel(status: EarningStatus): string {
    return earningStatusLabel(status);
  }

  percent(basisPoints: number): number {
    return commissionPercent(basisPoints);
  }

  requestPayout(): void {
    this.requesting.set(true);
    this.payoutError.set(null);

    // Sin cuerpo: el monto lo calcula el backend. Mandar uno aquí sería pedirle al cliente que
    // decida cuánto se transfiere, y el backend lo rechaza justamente por eso.
    this.paymentsApi.payout().subscribe({
      next: (payout) => {
        this.requesting.set(false);
        this.lastPayout.set(payout);
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.requesting.set(false);
        this.payoutError.set(this.describeError(error));
      }
    });
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.paymentsApi.earnings().subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('No pudimos cargar tu saldo. Intenta de nuevo en un momento.');
        this.loading.set(false);
      }
    });

    this.paymentsApi.payouts().subscribe({
      next: (payouts) => this.payouts.set(payouts),
      error: () => this.payouts.set([])
    });
  }

  private describeError(error: HttpErrorResponse): string {
    if (error.status === 409) {
      return 'No tienes saldo disponible para transferir.';
    }
    if (error.status === 403) {
      return 'Tu cuenta no tiene permiso para solicitar transferencias.';
    }
    return 'No pudimos registrar la solicitud. Intenta de nuevo en un momento.';
  }
}
