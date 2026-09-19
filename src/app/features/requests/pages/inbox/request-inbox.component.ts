import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  OpenRequestSummaryResponse,
  RepairRequestControllerService,
  Specialty
} from '../../../../api/generated';
import { SPECIALTY_OPTIONS, specialtyLabel } from '../../utils/request-ui.helpers';

// FR-UC-18: bandeja del Fixer. Muestra las solicitudes abiertas filtradas en el backend
// según las especialidades del técnico autenticado. Incluye filtro visual en memoria.
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
          <select [ngModel]="selectedSpecialty()" (ngModelChange)="filterBy($event)" name="specialty">
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
      } @else if (filteredRequests().length === 0) {
        <p class="state">
          No hay solicitudes abiertas
          {{ selectedSpecialty() ? 'en esta especialidad' : '' }} por ahora.
        </p>
      } @else {
        <ul class="request-list">
          @for (request of filteredRequests(); track request.requestId) {
            <li class="request-card">
              <div class="card-top">
                <span class="chip">{{ label(request.specialty) }}</span>
                <span class="date">{{ request.createdAt | date: 'dd/MM/yyyy' }}</span>
              </div>
              <h2 class="card-title">{{ request.title }}</h2>
              <div class="card-footer">
                <span class="status-indicator">Disponible para cotizar</span>
                <a class="cta" [routerLink]="['/requests', request.requestId]">Ver y cotizar →</a>
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
      font-size: 1.05rem; margin: 0 0 0.75rem 0;
    }
    .card-footer { display: flex; justify-content: space-between; align-items: center; }
    .status-indicator { font-size: 0.78rem; color: #047857; font-weight: 600; }
    .cta { color: var(--fixup-color-accent); font-weight: 700; font-size: 0.86rem; text-decoration: none; }
    .cta:hover { text-decoration: underline; }
  `]
})
export class RequestInboxComponent implements OnInit {
  private readonly repairRequestApi = inject(RepairRequestControllerService);

  readonly specialtyOptions = SPECIALTY_OPTIONS;
  readonly allRequests = signal<OpenRequestSummaryResponse[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly selectedSpecialty = signal<Specialty | null>(null);

  readonly filteredRequests = computed(() => {
    const specialty = this.selectedSpecialty();
    const list = this.allRequests();
    if (!specialty) {
      return list;
    }
    return list.filter((r) => r.specialty === specialty);
  });

  ngOnInit(): void {
    this.load();
  }

  label(specialty: Specialty): string {
    return specialtyLabel(specialty);
  }

  filterBy(specialty: Specialty | null): void {
    // In-memory visual filtering: no call to backend
    this.selectedSpecialty.set(specialty);
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    // GET /requests/open takes no query parameters; backend handles fixer specialties
    this.repairRequestApi.open1().subscribe({
      next: (requests) => {
        this.allRequests.set(requests);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No pudimos cargar las solicitudes. Intenta de nuevo.');
        this.loading.set(false);
      }
    });
  }
}
