import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  QuotationControllerService,
  RepairRequestControllerService,
  RepairRequestStatus,
  RequestDetailResponse,
  Specialty
} from '../../../../api/generated';
import { CurrentUserStore } from '../../../../core/auth/current-user.store';
import {
  MAX_ESTIMATED_DAYS,
  MAX_MESSAGE_LENGTH,
  MIN_ESTIMATED_DAYS,
  safeIntegerAmountValidator
} from '../../../quotations/utils/quotation-ui.helpers';
import { requestStatusLabel, specialtyLabel } from '../../utils/request-ui.helpers';

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
            <span class="chip">{{ specialtyName(item.specialty) }}</span>
            <span class="status" [class.assigned]="item.status === 'ASSIGNED'">
              {{ statusName(item.status) }}
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
          @if (!item.photos || item.photos.length === 0) {
            <p class="muted">No se adjuntaron fotos para esta solicitud.</p>
          } @else {
            <div class="photo-gallery">
              @for (photo of item.photos; track photo.readUrl) {
                <div class="photo-card">
                  @if (failedImageUrls().has(photo.readUrl)) {
                    <div class="photo-placeholder">
                      <span class="placeholder-icon">⚠️</span>
                      <span class="placeholder-text">Enlace expirado o error de carga</span>
                      <button type="button" class="reload-photo-btn" (click)="reloadDetail()">
                        Recargar imagen
                      </button>
                    </div>
                  } @else {
                    <img
                      [src]="photo.readUrl"
                      [alt]="item.title"
                      class="request-image"
                      (error)="onImageError(photo.readUrl)"
                      loading="lazy"
                    />
                  }
                </div>
              }
            </div>
          }
        </article>

        @if (canViewQuotations()) {
          <a class="board-link" [routerLink]="['/quotations/request', item.requestId]">
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
                  <span>Costo total (COP entero)</span>
                  <input
                    type="number"
                    formControlName="amount"
                    min="1"
                    step="1"
                    placeholder="450000"
                  />
                  @if (form.controls.amount.touched && form.controls.amount.invalid) {
                    <small class="field-error">
                      Ingresa un monto entero positivo válido en pesos colombianos.
                    </small>
                  }
                </label>

                <label class="field">
                  <span>Tiempo estimado (días)</span>
                  <input
                    type="number"
                    formControlName="estimatedDays"
                    min="1"
                    [max]="maxDays"
                    step="1"
                    placeholder="3"
                  />
                  @if (form.controls.estimatedDays.touched && form.controls.estimatedDays.invalid) {
                    <small class="field-error">Entre 1 y {{ maxDays }} días.</small>
                  }
                </label>

                <label class="field wide">
                  <span>Mensaje para el cliente (opcional, máx. {{ maxMessageLength }} caracteres)</span>
                  <textarea
                    formControlName="message"
                    rows="3"
                    [maxlength]="maxMessageLength"
                    placeholder="Incluye detalles de mano de obra, materiales y garantía..."
                  ></textarea>
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
    .photo-gallery {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 0.75rem; margin-top: 0.5rem;
    }
    .photo-card {
      position: relative; width: 100%; aspect-ratio: 1; border-radius: var(--fixup-radius-md);
      overflow: hidden; border: 1px solid rgba(154, 148, 141, 0.25); background: #f9f9f9;
    }
    .request-image { width: 100%; height: 100%; object-fit: cover; display: block; }
    .photo-placeholder {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      height: 100%; padding: 0.5rem; text-align: center; gap: 0.3rem; background: #faf8f5;
    }
    .placeholder-icon { font-size: 1.2rem; }
    .placeholder-text { font-size: 0.7rem; color: #888; }
    .reload-photo-btn {
      background: var(--fixup-color-primary); color: #fff; border: none; border-radius: 4px;
      font-size: 0.68rem; font-weight: 600; padding: 0.2rem 0.5rem; cursor: pointer;
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
export class RequestDetailComponent implements OnInit {
  private readonly repairRequestApi = inject(RepairRequestControllerService);
  private readonly quotationsApi = inject(QuotationControllerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly users = inject(CurrentUserStore);
  private readonly fb = inject(FormBuilder);

  readonly maxDays = MAX_ESTIMATED_DAYS;
  readonly maxMessageLength = MAX_MESSAGE_LENGTH;

  readonly request = signal<RequestDetailResponse | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly sending = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly submitted = signal(false);
  readonly failedImageUrls = signal<Set<string>>(new Set());

  readonly form = this.fb.nonNullable.group({
    amount: [
      null as number | null,
      [Validators.required, safeIntegerAmountValidator]
    ],
    estimatedDays: [
      null as number | null,
      [Validators.required, Validators.min(MIN_ESTIMATED_DAYS), Validators.max(MAX_ESTIMATED_DAYS)]
    ],
    message: ['', [Validators.maxLength(MAX_MESSAGE_LENGTH)]]
  });

  readonly isFixer = computed(() => this.users.hasRole('FIXER'));

  readonly canViewQuotations = computed(() => {
    const role = this.users.activeRole();
    return role === 'OWNER' || role === 'TENANT' || role === 'REAL_ESTATE_MANAGER';
  });

  // Solo cotiza un Fixer sobre una solicitud abierta
  readonly canQuote = computed(
    () => this.isFixer() && this.request()?.status === 'OPEN'
  );

  ngOnInit(): void {
    this.loadDetail();
  }

  loadDetail(): void {
    const requestId = this.route.snapshot.paramMap.get('requestId');
    if (!requestId) {
      this.loadError.set('La solicitud no existe.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.loadError.set(null);
    this.failedImageUrls.set(new Set());

    this.repairRequestApi.detail(requestId).subscribe({
      next: (req) => {
        this.request.set(req);
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

  reloadDetail(): void {
    this.loadDetail();
  }

  onImageError(readUrl: string): void {
    this.failedImageUrls.update((set) => {
      const updated = new Set(set);
      updated.add(readUrl);
      return updated;
    });
  }

  specialtyName(specialty: Specialty): string {
    return specialtyLabel(specialty);
  }

  statusName(status: RepairRequestStatus): string {
    return requestStatusLabel(status);
  }

  submit(): void {
    const currentRequest = this.request();
    if (this.form.invalid || !currentRequest) {
      this.form.markAllAsTouched();
      return;
    }

    const { amount, estimatedDays, message } = this.form.getRawValue();
    this.sending.set(true);
    this.submitError.set(null);

    this.quotationsApi
      .submit({
        requestId: currentRequest.requestId,
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
    if (error.status === 400) {
      return 'Los datos de la cotización son inválidos. Revisa el monto y tiempo estimado.';
    }
    if (error.status === 401) {
      return 'Tu sesión expiró. Inicia sesión de nuevo.';
    }
    if (error.status === 403) {
      return 'Tu perfil de Fixer todavía no está verificado, así que aún no puedes cotizar.';
    }
    if (error.status === 404) {
      return 'La solicitud ya no existe.';
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
