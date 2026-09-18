import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RequestsApiService } from '../../../../api/requests-api.service';
import {
  RepairRequest,
  SPECIALTY_OPTIONS,
  Specialty,
  specialtyLabel
} from '../../../../shared/models/repair-request.model';

// FR-UC-18: bandeja del Fixer. Es la "alerta de nuevo trabajo" del caso de uso:
// las solicitudes abiertas que puede evaluar antes de cotizar.
@Component({
  selector: 'app-request-inbox',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="inbox">
      <header class="inbox-header">
        <div>
          <h1 class="title">Solicitudes disponibles</h1>
          <p class="subtitle">Evalúa el daño y envía tu cotización antes que otro técnico.</p>
        </div>

        <label class="filter">
          <span>Especialidad</span>
          <select [ngModel]="specialty()" (ngModelChange)="filterBy($event)" name="specialty">
            <option [ngValue]="null">Todas</option>
            @for (option of specialtyOptions; track option.value) {
              <option [ngValue]="option.value">{{ option.label }}</option>
            }
          </select>
        </label>
      </header>

      @if (loading()) {
        <p class="state">Cargando solicitudes…</p>
      } @else if (error()) {
        <p class="state error">{{ error() }}</p>
      } @else if (requests().length === 0) {
        <p class="state">
          No hay solicitudes abiertas
          {{ specialty() ? 'en esta especialidad' : '' }} por ahora.
        </p>
      } @else {
        <ul class="request-list">
          @for (request of requests(); track request.id) {
            <li class="request-card">
              <div class="card-top">
                <span class="chip">{{ label(request.specialty) }}</span>
                <span class="date">{{ request.createdAt | date: 'dd/MM/yyyy' }}</span>
              </div>
              <h2 class="card-title">{{ request.title }}</h2>
              <p class="card-description">{{ request.description }}</p>
              <div class="card-footer">
                @if (request.photoKeys.length > 0) {
                  <span class="photos">{{ request.photoKeys.length }} foto(s)</span>
                } @else {
                  <span class="photos muted">Sin fotos</span>
                }
                <a class="cta" [routerLink]="['/requests', request.id]">Ver y cotizar →</a>
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: [`
    .inbox { display: flex; flex-direction: column; gap: 1.25rem; max-width: 900px; margin: 0 auto; }

    .inbox-header {
      display: flex; justify-content: space-between; align-items: flex-end;
      gap: 1rem; flex-wrap: wrap;
    }

    .title {
      font-family: var(--fixup-font-heading); color: var(--fixup-color-primary);
      font-size: 1.5rem; margin: 0 0 0.25rem 0;
    }

    .subtitle { color: #666; font-size: 0.9rem; margin: 0; }

    .filter { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.82rem; color: #666; }

    .filter select {
      border: 1px solid rgba(154, 148, 141, 0.4); border-radius: var(--fixup-radius-md);
      padding: 0.5rem 0.7rem; font: inherit; background: #fff; color: var(--fixup-color-primary);
      min-width: 170px;
    }

    .state { color: #666; font-size: 0.92rem; padding: 1.5rem 0; }
    .state.error { color: #b91c1c; }

    .request-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.9rem; }

    .request-card {
      background: #fff; border: 1px solid rgba(154, 148, 141, 0.2);
      border-radius: var(--fixup-radius-lg); padding: 1.15rem 1.25rem;
      box-shadow: var(--fixup-shadow-sm);
    }

    .card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }

    .chip {
      background: #f8f6f2; color: var(--fixup-color-earth-brown);
      border-radius: 20px; padding: 0.25rem 0.7rem; font-size: 0.76rem; font-weight: 700;
    }

    .date { color: #999; font-size: 0.78rem; }

    .card-title {
      font-family: var(--fixup-font-heading); color: var(--fixup-color-primary);
      font-size: 1.05rem; margin: 0 0 0.35rem 0;
    }

    .card-description {
      color: #555; font-size: 0.88rem; margin: 0 0 0.85rem 0; line-height: 1.45;
      display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2;
      -webkit-box-orient: vertical; overflow: hidden;
    }

    .card-footer { display: flex; justify-content: space-between; align-items: center; }

    .photos { font-size: 0.78rem; color: #666; }
    .photos.muted { color: #aaa; }

    .cta { color: var(--fixup-color-accent); font-weight: 700; font-size: 0.86rem; text-decoration: none; }
    .cta:hover { text-decoration: underline; }
  `]
})
export class RequestInboxComponent {
  private readonly api = inject(RequestsApiService);

  readonly specialtyOptions = SPECIALTY_OPTIONS;
  readonly requests = signal<RepairRequest[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly specialty = signal<Specialty | null>(null);

  constructor() {
    this.load();
  }

  label(specialty: Specialty): string {
    return specialtyLabel(specialty);
  }

  filterBy(specialty: Specialty | null): void {
    this.specialty.set(specialty);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.listOpen(this.specialty() ?? undefined).subscribe({
      next: (requests) => {
        this.requests.set(requests);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No pudimos cargar las solicitudes. Intenta de nuevo.');
        this.loading.set(false);
      }
    });
  }
}
