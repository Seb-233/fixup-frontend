import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RequestsApiService } from '../../../../api/requests-api.service';
import {
  MAX_REQUEST_PHOTOS,
  RepairRequest,
  SPECIALTY_OPTIONS,
  Specialty,
  requestStatusLabel,
  specialtyLabel
} from '../../../../shared/models/repair-request.model';

// FR-UC-18: el propietario abre la solicitud que los Fixers verán en su bandeja y
// sigue el estado de las que ya publicó.
@Component({
  selector: 'app-my-requests',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="mine">
      <header>
        <h1 class="title">Mis solicitudes</h1>
        <p class="subtitle">Describe el daño y recibe cotizaciones de técnicos verificados.</p>
      </header>

      <article class="block">
        <h2 class="block-title">Nueva solicitud</h2>

        <form [formGroup]="form" (ngSubmit)="submit()" class="form">
          <label class="field">
            <span>Especialidad</span>
            <select formControlName="specialty">
              @for (option of specialtyOptions; track option.value) {
                <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
          </label>

          <label class="field">
            <span>Título</span>
            <input type="text" formControlName="title" maxlength="150" placeholder="Gotera en el baño" />
            @if (form.controls.title.touched && form.controls.title.invalid) {
              <small class="field-error">Escribe un título.</small>
            }
          </label>

          <label class="field wide">
            <span>Descripción del daño</span>
            <textarea formControlName="description" rows="4" maxlength="2000"
              placeholder="El agua cae desde el techo cuando el vecino abre la ducha."></textarea>
            @if (form.controls.description.touched && form.controls.description.invalid) {
              <small class="field-error">Describe el daño para que el técnico pueda cotizar.</small>
            }
          </label>

          <label class="field wide">
            <span>Fotos del daño (hasta {{ maxPhotos }})</span>
            <input type="text" formControlName="photoKeys"
              placeholder="clave/foto-1.jpg, clave/foto-2.jpg" />
            <small class="field-hint">
              Separadas por coma. La carga directa de imágenes llega con el módulo de
              almacenamiento; por ahora se envían las claves.
            </small>
            @if (tooManyPhotos()) {
              <small class="field-error">Máximo {{ maxPhotos }} fotos.</small>
            }
          </label>

          @if (submitError()) {
            <p class="submit-error">{{ submitError() }}</p>
          }

          <button type="submit" class="primary" [disabled]="form.invalid || tooManyPhotos() || sending()">
            {{ sending() ? 'Publicando…' : 'Publicar solicitud' }}
          </button>
        </form>
      </article>

      <article class="block">
        <h2 class="block-title">Publicadas</h2>

        @if (loading()) {
          <p class="state">Cargando…</p>
        } @else if (loadError()) {
          <p class="state error">{{ loadError() }}</p>
        } @else if (requests().length === 0) {
          <p class="state">Todavía no has publicado ninguna solicitud.</p>
        } @else {
          <ul class="list">
            @for (request of requests(); track request.id) {
              <li class="row">
                <div class="row-main">
                  <span class="chip">{{ label(request.specialty) }}</span>
                  <span class="row-title">{{ request.title }}</span>
                </div>
                <div class="row-side">
                  <span class="status" [class.assigned]="request.status === 'ASSIGNED'">
                    {{ statusLabel(request) }}
                  </span>
                  <a class="cta" [routerLink]="['/quotations/request', request.id]">Ver ofertas →</a>
                </div>
              </li>
            }
          </ul>
        }
      </article>
    </section>
  `,
  styles: [`
    .mine { display: flex; flex-direction: column; gap: 1.25rem; max-width: 860px; margin: 0 auto; }

    .title {
      font-family: var(--fixup-font-heading); color: var(--fixup-color-primary);
      font-size: 1.5rem; margin: 0 0 0.25rem 0;
    }

    .subtitle { color: #666; font-size: 0.9rem; margin: 0; }

    .block {
      background: #fff; border: 1px solid rgba(154, 148, 141, 0.2);
      border-radius: var(--fixup-radius-lg); padding: 1.25rem; box-shadow: var(--fixup-shadow-sm);
    }

    .block-title {
      font-family: var(--fixup-font-heading); color: var(--fixup-color-primary);
      font-size: 1.05rem; margin: 0 0 0.85rem 0;
    }

    .form { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; }
    @media (max-width: 640px) { .form { grid-template-columns: 1fr; } }

    .field { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.82rem; color: #666; }
    .field.wide { grid-column: 1 / -1; }

    .field input, .field select, .field textarea {
      border: 1px solid rgba(154, 148, 141, 0.4); border-radius: var(--fixup-radius-md);
      padding: 0.55rem 0.7rem; font: inherit; color: var(--fixup-color-primary);
      background: #fff; resize: vertical;
    }

    .field-hint { color: #999; font-size: 0.74rem; line-height: 1.35; }
    .field-error { color: #b91c1c; font-size: 0.74rem; }

    .submit-error {
      grid-column: 1 / -1; color: #b91c1c; font-size: 0.85rem; margin: 0;
      background: rgba(185, 28, 28, 0.06); border-radius: var(--fixup-radius-md); padding: 0.6rem 0.75rem;
    }

    .primary {
      grid-column: 1 / -1; justify-self: start;
      background: var(--fixup-color-primary); color: #fff; border: none;
      border-radius: var(--fixup-radius-md); padding: 0.65rem 1.4rem;
      font: inherit; font-weight: 700; cursor: pointer;
    }

    .primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .primary:not(:disabled):hover { background: #1f2023; }

    .state { color: #666; font-size: 0.9rem; margin: 0; }
    .state.error { color: #b91c1c; }

    .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }

    .row {
      display: flex; justify-content: space-between; align-items: center; gap: 1rem;
      flex-wrap: wrap; padding: 0.7rem 0.85rem; background: #faf9f6;
      border-radius: var(--fixup-radius-md); border: 1px solid #efece5;
    }

    .row-main { display: flex; align-items: center; gap: 0.6rem; min-width: 0; }
    .row-side { display: flex; align-items: center; gap: 0.85rem; }

    .chip {
      background: #fff; color: var(--fixup-color-earth-brown); border: 1px solid #e8e6e1;
      border-radius: 20px; padding: 0.2rem 0.6rem; font-size: 0.72rem; font-weight: 700;
    }

    .row-title { color: var(--fixup-color-primary); font-size: 0.9rem; font-weight: 600; }

    .status {
      border-radius: 20px; padding: 0.2rem 0.6rem; font-size: 0.72rem; font-weight: 700;
      background: rgba(16, 185, 129, 0.15); color: #047857;
    }

    .status.assigned { background: rgba(154, 148, 141, 0.2); color: #57534e; }

    .cta { color: var(--fixup-color-accent); font-weight: 700; font-size: 0.84rem; text-decoration: none; }
    .cta:hover { text-decoration: underline; }
  `]
})
export class MyRequestsComponent {
  private readonly api = inject(RequestsApiService);
  private readonly fb = inject(FormBuilder);

  readonly specialtyOptions = SPECIALTY_OPTIONS;
  readonly maxPhotos = MAX_REQUEST_PHOTOS;
  readonly requests = signal<RepairRequest[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly sending = signal(false);
  readonly submitError = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    specialty: ['GENERAL' as Specialty, Validators.required],
    title: ['', [Validators.required, Validators.maxLength(150)]],
    description: ['', [Validators.required, Validators.maxLength(2000)]],
    photoKeys: ['']
  });

  constructor() {
    this.load();
  }

  label(specialty: Specialty): string {
    return specialtyLabel(specialty);
  }

  statusLabel(request: RepairRequest): string {
    return requestStatusLabel(request.status);
  }

  tooManyPhotos(): boolean {
    return this.parsePhotoKeys().length > MAX_REQUEST_PHOTOS;
  }

  submit(): void {
    if (this.form.invalid || this.tooManyPhotos()) {
      this.form.markAllAsTouched();
      return;
    }

    const { specialty, title, description } = this.form.getRawValue();
    this.sending.set(true);
    this.submitError.set(null);

    this.api
      .open({
        specialty,
        title: title.trim(),
        description: description.trim(),
        photoKeys: this.parsePhotoKeys()
      })
      .subscribe({
        next: (created) => {
          this.requests.update((current) => [created, ...current]);
          this.form.reset({ specialty: 'GENERAL', title: '', description: '', photoKeys: '' });
          this.sending.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.sending.set(false);
          this.submitError.set(
            error.status === 403
              ? 'Tu cuenta no puede abrir solicitudes con el rol actual.'
              : 'No pudimos publicar la solicitud. Revisa los datos e intenta de nuevo.'
          );
        }
      });
  }

  private parsePhotoKeys(): string[] {
    return this.form.controls.photoKeys.value
      .split(',')
      .map((key) => key.trim())
      .filter((key) => key.length > 0);
  }

  private load(): void {
    this.api.listMine().subscribe({
      next: (requests) => {
        this.requests.set(requests);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('No pudimos cargar tus solicitudes.');
        this.loading.set(false);
      }
    });
  }
}
