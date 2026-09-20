import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { JobControllerService, JobResponse, JobStatus } from '../../../../api/generated';
import { jobStatusLabel } from '../../../payments/utils/earnings-ui.helpers';

/**
 * FR-UC-20: los trabajos del técnico.
 *
 * Cerrar el trabajo es el gesto que libera el dinero retenido, así que la pantalla lo dice en
 * esas palabras y no como un "marcar como terminado" cualquiera.
 */
@Component({
  selector: 'app-my-jobs',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="jobs">
      <header>
        <h1 class="title">Mis trabajos</h1>
        <p class="subtitle">
          Cada trabajo nace cuando un propietario acepta tu cotización. Al cerrarlo se libera el
          dinero que quedó retenido y pasa a tu saldo disponible.
        </p>
        <a class="link" routerLink="/payments/earnings">Ver mis ingresos →</a>
      </header>

      @if (loading()) {
        <p class="state">Cargando tus trabajos…</p>
      } @else if (loadError()) {
        <p class="state error">{{ loadError() }}</p>
      } @else if (jobs().length === 0) {
        <p class="state">
          Todavía no tienes trabajos. Cuando un propietario acepte una de tus cotizaciones,
          aparecerá aquí.
        </p>
      } @else {
        @if (actionError()) {
          <p class="state error">{{ actionError() }}</p>
        }

        @if (open().length > 0) {
          <h2 class="group">En curso</h2>
          <ul class="list">
            @for (job of open(); track job.id) {
              <li class="card">
                <div class="card-head">
                  <span class="status assigned">{{ statusLabel(job.status) }}</span>
                  <span class="date">Asignado el {{ job.createdAt | date: 'dd/MM/yyyy' }}</span>
                </div>
                <a class="link" [routerLink]="['/requests', job.requestId]">Ver la solicitud</a>
                <div class="card-foot">
                  <button
                    type="button"
                    class="primary complete-btn"
                    [disabled]="closingId() !== null"
                    (click)="complete(job)"
                  >
                    {{ closingId() === job.id ? 'Cerrando…' : 'Cerrar trabajo y liberar el pago' }}
                  </button>
                </div>
              </li>
            }
          </ul>
        }

        @if (closed().length > 0) {
          <h2 class="group">Cerrados</h2>
          <ul class="list">
            @for (job of closed(); track job.id) {
              <li class="card done">
                <div class="card-head">
                  <span class="status completed">{{ statusLabel(job.status) }}</span>
                  <span class="date">Cerrado el {{ job.completedAt | date: 'dd/MM/yyyy' }}</span>
                </div>
                <a class="link" [routerLink]="['/requests', job.requestId]">Ver la solicitud</a>
              </li>
            }
          </ul>
        }
      }
    </section>
  `,
  styles: [
    `
      .jobs {
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
        gap: 0.75rem;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      .card {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 1rem;
        border: 1px solid var(--fixup-border, #d8dee9);
        border-radius: 0.75rem;
        background: var(--fixup-surface, #fff);
      }
      .card.done {
        opacity: 0.75;
      }
      .card-head {
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
      .status.assigned {
        background: #fff4d6;
        color: #7a5800;
      }
      .status.completed {
        background: #e2f5e7;
        color: #1c6b34;
      }
      .date {
        font-size: 0.85rem;
        color: var(--fixup-text-muted, #5b6472);
      }
      .link {
        color: var(--fixup-accent, #1d4ed8);
        text-decoration: none;
        font-size: 0.9rem;
      }
      .card-foot {
        display: flex;
        justify-content: flex-end;
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
        cursor: progress;
      }
      .state {
        max-width: 60ch;
        color: var(--fixup-text-muted, #5b6472);
      }
      .state.error {
        color: #b3261e;
      }
    `
  ]
})
export class MyJobsComponent implements OnInit {
  private readonly jobsApi = inject(JobControllerService);

  readonly jobs = signal<JobResponse[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly closingId = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  readonly open = computed(() =>
    this.jobs().filter((job) => job.status === JobStatus.Assigned)
  );
  readonly closed = computed(() =>
    this.jobs().filter((job) => job.status === JobStatus.Completed)
  );

  ngOnInit(): void {
    this.load();
  }

  statusLabel(status: JobStatus): string {
    return jobStatusLabel(status);
  }

  complete(job: JobResponse): void {
    this.closingId.set(job.id);
    this.actionError.set(null);

    this.jobsApi.complete(job.id).subscribe({
      next: () => {
        this.closingId.set(null);
        // El backend liberó el ingreso en la misma operación, así que se relee la lista
        // completa en vez de adivinar el nuevo estado aquí.
        this.load();
      },
      error: (error: HttpErrorResponse) => {
        this.closingId.set(null);
        this.actionError.set(this.describeError(error));
      }
    });
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.jobsApi.mine2().subscribe({
      next: (jobs) => {
        this.jobs.set(jobs);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('No pudimos cargar tus trabajos. Intenta de nuevo en un momento.');
        this.loading.set(false);
      }
    });
  }

  private describeError(error: HttpErrorResponse): string {
    if (error.status === 409) {
      return 'Ese trabajo ya estaba cerrado.';
    }
    if (error.status === 403) {
      return 'Solo el técnico asignado puede cerrar este trabajo.';
    }
    return 'No pudimos cerrar el trabajo. Intenta de nuevo en un momento.';
  }
}
