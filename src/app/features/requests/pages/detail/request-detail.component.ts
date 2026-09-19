import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { QuotationsApiService } from '../../../../api/quotations-api.service';
import { RequestsApiService } from '../../../../api/requests-api.service';
import { CurrentUserStore } from '../../../../core/auth/current-user.store';
import { MAX_ESTIMATED_DAYS } from '../../../../shared/models/quotation.model';
import {
  RepairRequest,
  requestStatusLabel,
  specialtyLabel
} from '../../../../shared/models/repair-request.model';

// FR-UC-18: el Fixer evalúa la descripción y las fotografías del daño y envía su cotización
// con costo y tiempo estimado. El propietario ve la misma ficha con su tablero de ofertas.
@Component({
  selector: 'app-request-detail',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="detail">
      @if (loading()) {
        <p class="state">Cargando la solicitud…</p>
      } @else if (loadError()) {
        <p class="state error">{{ loadError() }}</p>
      } @else if (request(); as item) {
        <header class="head">
          <div class="head-meta">
            <span class="chip">{{ specialtyName(item) }}</span>
            <span class="status" [class.assigned]="item.status === 'ASSIGNED'">
              {{ statusName(item) }}
            </span>
          </div>
          <h1 class="title">{{ item.title }}</h1>
          <p class="date">Publicada el {{ item.createdAt | date: 'dd/MM/yyyy' }}</p>
        </header>

        <article class="block">
          <h2 class="block-title">Descripción del daño</h2>
          <p class="description">{{ item.description }}</p>
        </article>

        <article class="block">
          <h2 class="block-title">Evidencia fotográfica</h2>
          @if (item.photoKeys.length === 0) {
            <p class="muted">El propietario no adjuntó fotos.</p>
          } @else {
            <ul class="photo-list">
              @for (key of item.photoKeys; track key) {
                <li class="photo-key">{{ key }}</li>
              }
            </ul>
          }
        </article>

        @if (isOwner()) {
          <a class="board-link" [routerLink]="['/quotations/request', item.id]">
            Ver las cotizaciones recibidas →
          </a>
        }

        @if (canQuote()) {
          <article class="block quote-block">
            <h2 class="block-title">Enviar cotización</h2>

            @if (submitted()) {
              <p class="success">
                Tu cotización quedó enviada. Puedes seguirla en
                <a routerLink="/quotations/me">mis cotizaciones</a>.
              </p>
            } @else {
              <form [formGroup]="form" (ngSubmit)="submit()" class="quote-form">
                <label class="field">
                  <span>Costo total (COP)</span>
                  <input type="number" formControlName="amount" min="1" step="1" placeholder="450000" />
                  @if (form.controls.amount.touched && form.controls.amount.invalid) {
                    <small class="field-error">Ingresa un monto mayor que cero.</small>
                  }
                </label>

                <label class="field">
                  <span>Tiempo estimado (días)</span>
                  <input type="number" formControlName="estimatedDays" min="1" [max]="maxDays" step="1" placeholder="3" />
                  @if (form.controls.estimatedDays.touched && form.controls.estimatedDays.invalid) {
                    <small class="field-error">Entre 1 y {{ maxDays }} días.</small>
                  }
                </label>

                <label class="field wide">
                  <span>Mensaje para el propietario (opcional)</span>
                  <textarea formControlName="message" rows="3" maxlength="1000"
                    placeholder="Incluye materiales, sellado y garantía de seis meses."></textarea>
                </label>

                @if (submitError()) {
                  <p class="submit-error">{{ submitError() }}</p>
                }

                <button type="submit" class="primary" [disabled]="form.invalid || sending()">
                  {{ sending() ? 'Enviando…' : 'Enviar cotización' }}
                </button>
              </form>
            }
          </article>
        } @else if (isFixer() && item.status === 'ASSIGNED') {
          <p class="muted closed">Esta solicitud ya fue asignada y no admite más cotizaciones.</p>
        }
      }
    </section>
  `,
  styles: [`
    .detail { display: flex; flex-direction: column; gap: 1.25rem; max-width: 800px; margin: 0 auto; }

    .state { color: #666; font-size: 0.92rem; padding: 1.5rem 0; }
    .state.error { color: #b91c1c; }

    .head-meta { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem; }

    .chip {
      background: #f8f6f2; color: var(--fixup-color-earth-brown);
      border-radius: 20px; padding: 0.25rem 0.7rem; font-size: 0.76rem; font-weight: 700;
    }

    .status {
      border-radius: 20px; padding: 0.25rem 0.7rem; font-size: 0.76rem; font-weight: 700;
      background: rgba(16, 185, 129, 0.15); color: #047857;
    }

    .status.assigned { background: rgba(154, 148, 141, 0.2); color: #57534e; }

    .title {
      font-family: var(--fixup-font-heading); color: var(--fixup-color-primary);
      font-size: 1.5rem; margin: 0 0 0.2rem 0;
    }

    .date { color: #999; font-size: 0.8rem; margin: 0; }

    .block {
      background: #fff; border: 1px solid rgba(154, 148, 141, 0.2);
      border-radius: var(--fixup-radius-lg); padding: 1.25rem;
      box-shadow: var(--fixup-shadow-sm);
    }

    .block-title {
      font-family: var(--fixup-font-heading); color: var(--fixup-color-primary);
      font-size: 1.05rem; margin: 0 0 0.6rem 0;
    }

    .description { color: #444; font-size: 0.92rem; line-height: 1.6; margin: 0; white-space: pre-line; }

    .muted { color: #999; font-size: 0.86rem; margin: 0; }
    .muted.closed { padding: 0.75rem 0; }

    .photo-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }

    .photo-key {
      font-family: monospace; font-size: 0.78rem; color: #666;
      background: #faf9f6; border-radius: var(--fixup-radius-sm); padding: 0.4rem 0.6rem;
      overflow-wrap: anywhere;
    }

    .board-link { color: var(--fixup-color-accent); font-weight: 700; font-size: 0.9rem; text-decoration: none; }
    .board-link:hover { text-decoration: underline; }

    .quote-form { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }

    @media (max-width: 640px) { .quote-form { grid-template-columns: 1fr; } }

    .field { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.82rem; color: #666; }
    .field.wide { grid-column: 1 / -1; }

    .field input, .field textarea {
      border: 1px solid rgba(154, 148, 141, 0.4); border-radius: var(--fixup-radius-md);
      padding: 0.55rem 0.7rem; font: inherit; color: var(--fixup-color-primary); background: #fff;
      resize: vertical;
    }

    .field-error { color: #b91c1c; font-size: 0.74rem; }

    .submit-error {
      grid-column: 1 / -1; color: #b91c1c; font-size: 0.85rem; margin: 0;
      background: rgba(185, 28, 28, 0.06); border-radius: var(--fixup-radius-md); padding: 0.6rem 0.75rem;
    }

    .success { color: #047857; font-size: 0.9rem; margin: 0; }
    .success a { color: var(--fixup-color-accent); font-weight: 700; }

    .primary {
      grid-column: 1 / -1; justify-self: start;
      background: var(--fixup-color-primary); color: #fff; border: none;
      border-radius: var(--fixup-radius-md); padding: 0.65rem 1.4rem;
      font: inherit; font-weight: 700; cursor: pointer;
    }

    .primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .primary:not(:disabled):hover { background: #1f2023; }
  `]
})
export class RequestDetailComponent {
  private readonly requestsApi = inject(RequestsApiService);
  private readonly quotationsApi = inject(QuotationsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly users = inject(CurrentUserStore);
  private readonly fb = inject(FormBuilder);

  readonly maxDays = MAX_ESTIMATED_DAYS;
  readonly request = signal<RepairRequest | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly sending = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly submitted = signal(false);

  readonly form = this.fb.nonNullable.group({
    amount: [null as number | null, [Validators.required, Validators.min(1)]],
    estimatedDays: [
      null as number | null,
      [Validators.required, Validators.min(1), Validators.max(MAX_ESTIMATED_DAYS)]
    ],
    message: ['']
  });

  readonly isOwner = computed(() => this.request()?.ownerUserId === this.users.user()?.id);
  readonly isFixer = computed(() => this.users.hasRole('FIXER'));

  // Solo cotiza un Fixer sobre una solicitud abierta que no sea suya.
  // El backend lo vuelve a comprobar y además exige que esté verificado.
  readonly canQuote = computed(
    () => this.isFixer() && !this.isOwner() && this.request()?.status === 'OPEN'
  );

  constructor() {
    const requestId = this.route.snapshot.paramMap.get('requestId');
    if (!requestId) {
      this.loadError.set('La solicitud no existe.');
      this.loading.set(false);
      return;
    }
    this.requestsApi.getById(requestId).subscribe({
      next: (request) => {
        this.request.set(request);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loadError.set(
          error.status === 404 || error.status === 403
            ? 'No encontramos esta solicitud o no tienes permiso para verla.'
            : 'No pudimos cargar la solicitud. Intenta de nuevo.'
        );
        this.loading.set(false);
      }
    });
  }

  specialtyName(request: RepairRequest): string {
    return specialtyLabel(request.specialty);
  }

  statusName(request: RepairRequest): string {
    return requestStatusLabel(request.status);
  }

  submit(): void {
    const request = this.request();
    if (this.form.invalid || !request) {
      this.form.markAllAsTouched();
      return;
    }

    const { amount, estimatedDays, message } = this.form.getRawValue();
    this.sending.set(true);
    this.submitError.set(null);

    this.quotationsApi
      .submit({
        requestId: request.id,
        amount: Number(amount),
        estimatedDays: Number(estimatedDays),
        message: message?.trim() ? message.trim() : undefined
      })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.submitted.set(true);
          void this.router.navigate(['/quotations/me']);
        },
        error: (error: HttpErrorResponse) => {
          this.sending.set(false);
          this.submitError.set(this.messageFor(error));
        }
      });
  }

  private messageFor(error: HttpErrorResponse): string {
    if (error.status === 403) {
      return 'Tu perfil de Fixer todavía no está verificado, así que aún no puedes cotizar.';
    }
    if (error.status === 409) {
      const code = error.error?.code;
      if (code === 'ALREADY_QUOTED') {
        return 'Ya enviaste una cotización para esta solicitud.';
      }
      if (code === 'REQUEST_NOT_OPEN') {
        return 'La solicitud ya fue asignada a otro técnico.';
      }
      return 'La solicitud no admite esta cotización.';
    }
    return 'No pudimos enviar la cotización. Intenta de nuevo.';
  }
}
