import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { QuotationsApiService } from '../../../../api/quotations-api.service';
import { Quotation, quotationStatusLabel } from '../../../../shared/models/quotation.model';

// FR-UC-18: las cotizaciones que el Fixer envió y en qué quedaron.
@Component({
  selector: 'app-my-quotations',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="mine">
      <header>
        <h1 class="title">Mis cotizaciones</h1>
        <p class="subtitle">
          @if (accepted() > 0) {
            {{ accepted() }} de {{ quotations().length }} fueron aceptadas.
          } @else {
            Seguimiento de las ofertas que enviaste.
          }
        </p>
      </header>

      @if (loading()) {
        <p class="state">Cargando…</p>
      } @else if (error()) {
        <p class="state error">{{ error() }}</p>
      } @else if (quotations().length === 0) {
        <p class="state">
          Todavía no has cotizado. Mira la
          <a routerLink="/requests/inbox">bandeja de solicitudes</a> para empezar.
        </p>
      } @else {
        <ul class="list">
          @for (quotation of quotations(); track quotation.id) {
            <li class="row" [class.accepted]="quotation.status === 'ACCEPTED'">
              <div class="row-main">
                <span class="amount">{{ quotation.amount | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</span>
                <span class="days">{{ quotation.estimatedDays }} día(s)</span>
              </div>
              <div class="row-side">
                <span class="status" [class]="quotation.status.toLowerCase()">
                  {{ statusLabel(quotation) }}
                </span>
                <a class="cta" [routerLink]="['/requests', quotation.requestId]">Ver solicitud →</a>
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: [`
    .mine { display: flex; flex-direction: column; gap: 1.1rem; max-width: 800px; margin: 0 auto; }

    .title {
      font-family: var(--fixup-font-heading); color: var(--fixup-color-primary);
      font-size: 1.5rem; margin: 0 0 0.25rem 0;
    }

    .subtitle { color: #666; font-size: 0.9rem; margin: 0; }

    .state { color: #666; font-size: 0.9rem; margin: 0; padding: 1rem 0; }
    .state.error { color: #b91c1c; }
    .state a { color: var(--fixup-color-accent); font-weight: 700; }

    .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }

    .row {
      display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;
      background: #fff; border: 1px solid rgba(154, 148, 141, 0.2);
      border-radius: var(--fixup-radius-md); padding: 0.85rem 1rem;
    }

    .row.accepted { border-color: rgba(16, 185, 129, 0.5); background: #f7fdfa; }

    .row-main { display: flex; align-items: baseline; gap: 0.75rem; }
    .row-side { display: flex; align-items: center; gap: 0.85rem; }

    .amount {
      font-family: var(--fixup-font-heading); color: var(--fixup-color-primary);
      font-size: 1.1rem; font-weight: 700;
    }

    .days { color: #666; font-size: 0.84rem; }

    .status { border-radius: 20px; padding: 0.2rem 0.6rem; font-size: 0.72rem; font-weight: 700; }
    .status.submitted { background: rgba(206, 172, 120, 0.25); color: #8a6a33; }
    .status.accepted { background: rgba(16, 185, 129, 0.18); color: #047857; }
    .status.rejected { background: rgba(154, 148, 141, 0.2); color: #6b6b6b; }

    .cta { color: var(--fixup-color-accent); font-weight: 700; font-size: 0.84rem; text-decoration: none; }
    .cta:hover { text-decoration: underline; }
  `]
})
export class MyQuotationsComponent {
  private readonly api = inject(QuotationsApiService);

  readonly quotations = signal<Quotation[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly accepted = computed(
    () => this.quotations().filter((quotation) => quotation.status === 'ACCEPTED').length
  );

  constructor() {
    this.api.listMine().subscribe({
      next: (quotations) => {
        this.quotations.set(quotations);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No pudimos cargar tus cotizaciones.');
        this.loading.set(false);
      }
    });
  }

  statusLabel(quotation: Quotation): string {
    return quotationStatusLabel(quotation.status);
  }
}
