import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { QuotationsApiService } from '../../../../api/quotations-api.service';
import { RequestsApiService } from '../../../../api/requests-api.service';
import {
  Quotation,
  quotationStatusLabel
} from '../../../../shared/models/quotation.model';
import { RepairRequest } from '../../../../shared/models/repair-request.model';

// FR-UC-18: el tablero comparativo del propietario. Las ofertas llegan de la más barata a la
// más cara; aceptar una cierra la solicitud y rechaza las demás en la misma transacción.
@Component({
  selector: 'app-quotation-board',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="board">
      <header>
        <a class="back" [routerLink]="['/requests', requestId]">← Volver a la solicitud</a>
        <h1 class="title">Cotizaciones recibidas</h1>
        @if (request(); as item) {
          <p class="subtitle">{{ item.title }}</p>
        }
      </header>

      @if (loading()) {
        <p class="state">Cargando cotizaciones…</p>
      } @else if (loadError()) {
        <p class="state error">{{ loadError() }}</p>
      } @else if (quotations().length === 0) {
        <p class="state">
          Todavía no has recibido ofertas. Los técnicos verificados de la especialidad ya la ven
          en su bandeja.
        </p>
      } @else {
        @if (assigned()) {
          <p class="banner">Ya elegiste un técnico para esta solicitud.</p>
        }

        <ul class="list">
          @for (quotation of quotations(); track quotation.id) {
            <li class="card" [class.accepted]="quotation.status === 'ACCEPTED'">
              <div class="card-head">
                <span class="amount">{{ quotation.amount | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</span>
                <span class="status" [class]="quotation.status.toLowerCase()">
                  {{ statusLabel(quotation) }}
                </span>
              </div>

              <p class="days">Tiempo estimado: {{ quotation.estimatedDays }} día(s)</p>

              @if (quotation.message) {
                <p class="message">{{ quotation.message }}</p>
              } @else {
                <p class="message muted">El técnico no dejó mensaje.</p>
              }

              <div class="card-foot">
                <span class="date">Recibida el {{ quotation.createdAt | date: 'dd/MM/yyyy' }}</span>
                @if (quotation.status === 'SUBMITTED' && !assigned()) {
                  <button type="button" class="primary"
                    [disabled]="accepting() !== null"
                    (click)="accept(quotation)">
                    {{ accepting() === quotation.id ? 'Aceptando…' : 'Aceptar esta oferta' }}
                  </button>
                }
              </div>
            </li>
          }
        </ul>

        @if (acceptError()) {
          <p class="state error">{{ acceptError() }}</p>
        }
      }
    </section>
  `,
  styles: [`
    .board { display: flex; flex-direction: column; gap: 1.1rem; max-width: 800px; margin: 0 auto; }

    .back { color: #888; font-size: 0.82rem; text-decoration: none; }
    .back:hover { color: var(--fixup-color-primary); }

    .title {
      font-family: var(--fixup-font-heading); color: var(--fixup-color-primary);
      font-size: 1.5rem; margin: 0.4rem 0 0.2rem 0;
    }

    .subtitle { color: #666; font-size: 0.9rem; margin: 0; }

    .state { color: #666; font-size: 0.9rem; margin: 0; padding: 1rem 0; }
    .state.error { color: #b91c1c; }

    .banner {
      background: rgba(16, 185, 129, 0.1); color: #047857; border-radius: var(--fixup-radius-md);
      padding: 0.7rem 0.9rem; font-size: 0.86rem; margin: 0;
    }

    .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.85rem; }

    .card {
      background: #fff; border: 1px solid rgba(154, 148, 141, 0.2);
      border-radius: var(--fixup-radius-lg); padding: 1.1rem 1.25rem;
      box-shadow: var(--fixup-shadow-sm);
    }

    .card.accepted { border-color: rgba(16, 185, 129, 0.5); background: #f7fdfa; }

    .card-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; }

    .amount {
      font-family: var(--fixup-font-heading); color: var(--fixup-color-primary);
      font-size: 1.3rem; font-weight: 700;
    }

    .status { border-radius: 20px; padding: 0.22rem 0.65rem; font-size: 0.72rem; font-weight: 700; }
    .status.submitted { background: rgba(206, 172, 120, 0.25); color: #8a6a33; }
    .status.accepted { background: rgba(16, 185, 129, 0.18); color: #047857; }
    .status.rejected { background: rgba(154, 148, 141, 0.2); color: #6b6b6b; }

    .days { color: #555; font-size: 0.86rem; margin: 0 0 0.45rem 0; }

    .message { color: #444; font-size: 0.88rem; line-height: 1.5; margin: 0 0 0.85rem 0; white-space: pre-line; }
    .message.muted { color: #aaa; }

    .card-foot { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }

    .date { color: #999; font-size: 0.78rem; }

    .primary {
      background: var(--fixup-color-primary); color: #fff; border: none;
      border-radius: var(--fixup-radius-md); padding: 0.5rem 1.1rem;
      font: inherit; font-size: 0.86rem; font-weight: 700; cursor: pointer;
    }

    .primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .primary:not(:disabled):hover { background: #1f2023; }
  `]
})
export class QuotationBoardComponent {
  private readonly quotationsApi = inject(QuotationsApiService);
  private readonly requestsApi = inject(RequestsApiService);
  private readonly route = inject(ActivatedRoute);

  readonly requestId = this.route.snapshot.paramMap.get('requestId') ?? '';
  readonly quotations = signal<Quotation[]>([]);
  readonly request = signal<RepairRequest | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly accepting = signal<string | null>(null);
  readonly acceptError = signal<string | null>(null);

  // Una vez aceptada una oferta, ninguna otra admite decisión
  readonly assigned = computed(() =>
    this.quotations().some((quotation) => quotation.status === 'ACCEPTED')
  );

  constructor() {
    if (!this.requestId) {
      this.loadError.set('La solicitud no existe.');
      this.loading.set(false);
      return;
    }
    this.requestsApi.getById(this.requestId).subscribe({
      next: (request) => this.request.set(request),
      error: () => this.request.set(null)
    });
    this.load();
  }

  statusLabel(quotation: Quotation): string {
    return quotationStatusLabel(quotation.status);
  }

  accept(quotation: Quotation): void {
    this.accepting.set(quotation.id);
    this.acceptError.set(null);
    this.quotationsApi.accept(quotation.id).subscribe({
      next: () => {
        this.accepting.set(null);
        // El backend rechazó las demás en la misma transacción: se relee todo el tablero.
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.accepting.set(null);
        this.acceptError.set(
          error.status === 409
            ? 'Esta oferta ya no se puede aceptar. Actualiza el tablero.'
            : 'No pudimos aceptar la oferta. Intenta de nuevo.'
        );
      }
    });
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.quotationsApi.listForRequest(this.requestId).subscribe({
      next: (quotations) => {
        this.quotations.set(quotations);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loadError.set(
          error.status === 403
            ? 'Solo el dueño de la solicitud puede ver sus cotizaciones.'
            : 'No pudimos cargar las cotizaciones.'
        );
        this.loading.set(false);
      }
    });
  }
}
