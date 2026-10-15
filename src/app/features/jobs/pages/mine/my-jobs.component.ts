import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  CompletionRequest,
  JobControllerService,
  JobResponse,
  JobStatus
} from '../../../../api/generated';
import { jobStatusLabel } from '../../../payments/utils/earnings-ui.helpers';
import { paymentMethodLabel } from '../../../requests/utils/request-ui.helpers';

@Component({
  selector: 'app-my-jobs',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="jobs">
      <header>
        <h1 class="title">Mis trabajos</h1>
        <p class="subtitle">
          Cada trabajo nace cuando un propietario acepta tu cotización. Al cerrarlo se liquida el
          pago correspondiente.
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

        @if (successMessage()) {
          <p class="state success">{{ successMessage() }}</p>
        }

        @if (open().length > 0) {
          <h2 class="group">En curso</h2>
          <ul class="list">
            @for (job of open(); track job.id) {
              <li class="card">
                <div class="card-head">
                  <div class="head-badges">
                    <span class="status assigned">{{ statusLabel(job.status) }}</span>
                    <span class="method-chip">{{ methodLabel(job.paymentMethod) }}</span>
                  </div>
                  <span class="date">Asignado el {{ job.createdAt | date: 'dd/MM/yyyy' }}</span>
                </div>

                <div class="job-meta">
                  <span class="amount-label">Monto acordado:</span>
                  <strong class="amount-value">{{ job.agreedAmount | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</strong>
                </div>

                <a class="link" [routerLink]="['/requests', job.requestId]" [queryParams]="{ from: 'jobs' }">Ver la solicitud →</a>

                <div class="card-foot">
                  <button
                    type="button"
                    class="primary complete-btn"
                    [disabled]="closingId() !== null"
                    (click)="onCompleteClick(job)"
                  >
                    {{ closingId() === job.id ? 'Cerrando…' : (job.paymentMethod === 'CASH' ? 'Completar y liquidar efectivo' : 'Cerrar trabajo y liberar el pago') }}
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
                  <div class="head-badges">
                    <span class="status completed">{{ statusLabel(job.status) }}</span>
                    <span class="method-chip">{{ methodLabel(job.paymentMethod) }}</span>
                  </div>
                  <span class="date">Cerrado el {{ job.completedAt | date: 'dd/MM/yyyy' }}</span>
                </div>
                <div class="job-meta">
                  <span class="amount-label">Monto acordado:</span>
                  <strong class="amount-value">{{ job.agreedAmount | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</strong>
                </div>
                <a class="link" [routerLink]="['/requests', job.requestId]" [queryParams]="{ from: 'jobs' }">Ver la solicitud →</a>
              </li>
            }
          </ul>
        }
      }

      <!-- MODAL / PASO INTERACTIVO DE CIERRE PARA CASH -->
      @if (activeCashJob(); as cashJob) {
        <div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div class="modal-card">
            <h2 id="modal-title" class="modal-title">Liquidación de pago en efectivo</h2>
            <p class="modal-subtitle">
              Monto acordado para este trabajo:
              <strong>{{ cashJob.agreedAmount | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</strong>
            </p>

            <fieldset class="modal-field">
              <legend class="field-legend">¿Recibiste el pago completo en efectivo?</legend>

              <div class="radio-options">
                <label class="radio-choice">
                  <input
                    type="radio"
                    name="cashChoice"
                    value="YES"
                    [checked]="cashFullReceived()"
                    (change)="setCashChoice(true)"
                  />
                  <span>Sí, recibí el pago completo ({{ cashJob.agreedAmount | currency: 'COP' : 'symbol-narrow' : '1.0-0' }})</span>
                </label>

                <label class="radio-choice">
                  <input
                    type="radio"
                    name="cashChoice"
                    value="NO"
                    [checked]="!cashFullReceived()"
                    (change)="setCashChoice(false)"
                  />
                  <span>No, recibí un valor parcial o no recibí dinero</span>
                </label>
              </div>
            </fieldset>

            @if (!cashFullReceived()) {
              <div class="partial-input-group">
                <label for="cash-received-amount" class="input-label">Monto recibido en efectivo ($ COP):</label>
                <input
                  id="cash-received-amount"
                  type="number"
                  min="0"
                  [max]="cashJob.agreedAmount"
                  step="100"
                  [(ngModel)]="cashReceivedInput"
                  placeholder="0"
                  class="amount-input"
                />
                <small class="input-help">
                  Ingresa un valor entre $0 y {{ cashJob.agreedAmount | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}.
                  Si fue 0, ingresa 0.
                </small>
              </div>
            }

            @if (cashValidationError()) {
              <p class="field-error">{{ cashValidationError() }}</p>
            }

            <div class="modal-actions">
              <button
                type="button"
                class="secondary"
                [disabled]="closingId() !== null"
                (click)="cancelCashModal()"
              >
                Cancelar
              </button>
              <button
                type="button"
                class="primary"
                [disabled]="closingId() !== null"
                (click)="confirmCashComplete(cashJob)"
              >
                {{ closingId() === cashJob.id ? 'Completando…' : 'Confirmar finalización' }}
              </button>
            </div>
          </div>
        </div>
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
        max-width: 860px;
        margin: 0 auto;
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
        gap: 0.65rem;
        padding: 1.15rem;
        border: 1px solid var(--fixup-border, #d8dee9);
        border-radius: 0.75rem;
        background: var(--fixup-surface, #fff);
      }
      .card.done {
        opacity: 0.8;
      }
      .card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
      .head-badges {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .status {
        padding: 0.15rem 0.6rem;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 700;
      }
      .status.assigned {
        background: #fff4d6;
        color: #7a5800;
      }
      .status.completed {
        background: #e2f5e7;
        color: #1c6b34;
      }
      .method-chip {
        background: #f0ede6;
        color: #4A463F;
        border-radius: 999px;
        padding: 0.15rem 0.55rem;
        font-size: 0.72rem;
        font-weight: 600;
      }
      .date {
        font-size: 0.82rem;
        color: var(--fixup-text-muted, #5b6472);
      }
      .job-meta {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.92rem;
      }
      .amount-label {
        color: var(--fixup-text-muted, #5b6472);
      }
      .amount-value {
        color: var(--fixup-color-primary, #2D2E31);
        font-weight: 700;
      }
      .link {
        color: var(--fixup-accent, #1d4ed8);
        text-decoration: none;
        font-size: 0.88rem;
        font-weight: 600;
      }
      .link:hover { text-decoration: underline; }
      .card-foot {
        display: flex;
        justify-content: flex-end;
        margin-top: 0.25rem;
      }
      .primary {
        padding: 0.55rem 1.15rem;
        border: none;
        border-radius: 0.5rem;
        background: var(--fixup-accent, #1d4ed8);
        color: #fff;
        font-weight: 700;
        cursor: pointer;
        font-size: 0.88rem;
      }
      .primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .secondary {
        padding: 0.55rem 1rem;
        border: 1px solid #d8dee9;
        border-radius: 0.5rem;
        background: #fff;
        color: #4A463F;
        font-weight: 600;
        cursor: pointer;
        font-size: 0.88rem;
      }
      .secondary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .state {
        max-width: 60ch;
        color: var(--fixup-text-muted, #5b6472);
      }
      .state.error {
        color: #b3261e;
        background: #fef2f2;
        padding: 0.6rem 0.8rem;
        border-radius: 6px;
      }
      .state.success {
        color: #065f46;
        background: #ecfdf5;
        padding: 0.6rem 0.8rem;
        border-radius: 6px;
      }

      /* Modal styles */
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 1rem;
      }
      .modal-card {
        background: #fff;
        border-radius: 0.75rem;
        max-width: 480px;
        width: 100%;
        padding: 1.5rem;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .modal-title {
        font-size: 1.2rem;
        font-weight: 700;
        margin: 0;
        color: #2D2E31;
      }
      .modal-subtitle {
        font-size: 0.9rem;
        color: #5b6472;
        margin: 0;
      }
      .modal-field {
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        padding: 0.85rem;
        margin: 0;
      }
      .field-legend {
        font-size: 0.88rem;
        font-weight: 600;
        color: #2D2E31;
        padding: 0 0.4rem;
      }
      .radio-options {
        display: flex;
        flex-direction: column;
        gap: 0.65rem;
        margin-top: 0.4rem;
      }
      .radio-choice {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.88rem;
        cursor: pointer;
        color: #2D2E31;
      }
      .partial-input-group {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .input-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: #2D2E31;
      }
      .amount-input {
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 0.55rem 0.75rem;
        font-size: 0.95rem;
      }
      .input-help {
        font-size: 0.78rem;
        color: #64748b;
      }
      .field-error {
        color: #b91c1c;
        font-size: 0.82rem;
        margin: 0;
      }
      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        margin-top: 0.5rem;
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
  readonly successMessage = signal<string | null>(null);

  // Estado para el modal de liquidación en efectivo
  readonly activeCashJob = signal<JobResponse | null>(null);
  readonly cashFullReceived = signal<boolean>(true);
  cashReceivedInput = '';
  readonly cashValidationError = signal<string | null>(null);

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

  methodLabel(method?: string | null): string {
    return paymentMethodLabel(method);
  }

  onCompleteClick(job: JobResponse): void {
    this.actionError.set(null);
    this.successMessage.set(null);

    if (job.paymentMethod === 'TRANSFER') {
      // Transferencia: no se pregunta dinero recibido
      this.executeComplete(job.id, {});
    } else {
      // Efectivo: abrir modal/paso explícito
      this.activeCashJob.set(job);
      this.cashFullReceived.set(true);
      this.cashReceivedInput = String(job.agreedAmount);
      this.cashValidationError.set(null);
    }
  }

  setCashChoice(isFull: boolean): void {
    this.cashFullReceived.set(isFull);
    this.cashValidationError.set(null);
    const job = this.activeCashJob();
    if (job) {
      this.cashReceivedInput = isFull ? String(job.agreedAmount) : '';
    }
  }

  cancelCashModal(): void {
    this.activeCashJob.set(null);
    this.cashValidationError.set(null);
  }

  confirmCashComplete(job: JobResponse): void {
    this.cashValidationError.set(null);

    let amountToSend: number;
    if (this.cashFullReceived()) {
      amountToSend = job.agreedAmount;
    } else {
      const trimmed = String(this.cashReceivedInput).trim();
      if (!trimmed && trimmed !== '0') {
        this.cashValidationError.set('Ingresa el monto recibido en efectivo.');
        return;
      }
      const parsed = Number(trimmed);
      if (isNaN(parsed)) {
        this.cashValidationError.set('El monto ingresado debe ser un número válido.');
        return;
      }
      if (parsed < 0) {
        this.cashValidationError.set('El monto no puede ser negativo.');
        return;
      }
      if (parsed > job.agreedAmount) {
        this.cashValidationError.set(
          `El monto no puede ser superior al acordado ($${job.agreedAmount.toLocaleString('es-CO')}).`
        );
        return;
      }
      amountToSend = parsed;
    }

    const req: CompletionRequest = {
      receivedAmount: String(amountToSend)
    };

    this.executeComplete(job.id, req, () => {
      this.activeCashJob.set(null);
      if (amountToSend < job.agreedAmount) {
        this.successMessage.set(
          `Trabajo completado. Se liquidaron $${amountToSend.toLocaleString('es-CO')} en efectivo; el saldo pendiente quedó registrado para el propietario.`
        );
      } else {
        this.successMessage.set('Trabajo completado exitosamente con pago total recibido.');
      }
    });
  }

  private executeComplete(jobId: string, req: CompletionRequest, onSuccess?: () => void): void {
    this.closingId.set(jobId);
    this.actionError.set(null);

    this.jobsApi.complete(jobId, req).subscribe({
      next: () => {
        this.closingId.set(null);
        if (onSuccess) {
          onSuccess();
        } else {
          this.successMessage.set('Trabajo cerrado exitosamente y pago liberado.');
        }
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

    this.jobsApi.mine4().subscribe({
      next: (jobs: JobResponse[]) => {
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
    if (error.status === 400 || error.error?.code === 'INVALID_CASH_RECEIVED_AMOUNT') {
      return 'El monto en efectivo ingresado es inválido para este trabajo.';
    }
    return 'No pudimos cerrar el trabajo. Intenta de nuevo en un momento.';
  }
}
