import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  RepairRequestControllerService,
  RepairRequestStatus,
  RequestDetailResponse,
  PropertyControllerService,
  PropertySummary,
  Specialty,
  UploadTicketDto
} from '../../../../api/generated';
import { RequestMediaService } from '../../services/request-media.service';
import {
  MAX_REQUEST_PHOTOS,
  requestStatusLabel,
  specialtyLabel
} from '../../utils/request-ui.helpers';

export interface RequestPhotoUploadItem {
  id: string;
  file: File;
  previewUrl: string;
  status: 'UPLOADING' | 'READY' | 'ERROR';
  stepMessage: string;
  mediaId?: string;
  ticket?: UploadTicketDto;
  error?: string;
}

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
          @if (propertiesLoading()) {
            <p class="state">Cargando propiedades…</p>
          } @else if (propertiesError()) {
            <p class="state error">{{ propertiesError() }}</p>
          } @else if (properties().length === 0) {
            <p class="state wide">
              Debes registrar una propiedad antes de crear una solicitud.
              <a [routerLink]="['/properties']">Registrar propiedad</a>
            </p>
          } @else {
            <label class="field">
              <span>Propiedad</span>
              <select formControlName="propertyId">
                <option value="" disabled>Selecciona una propiedad</option>
                @for (property of properties(); track property.id) {
                  <option [value]="property.id">{{ property.name }} — {{ property.address }} — {{ property.city }}</option>
                }
              </select>
              @if (form.controls.propertyId.touched && form.controls.propertyId.invalid) {
                <small class="field-error">Selecciona una propiedad.</small>
              }
            </label>
          }

          <label class="field">
            <span>Título</span>
            <input type="text" formControlName="title" maxlength="150" placeholder="Gotera en el baño" />
            @if (form.controls.title.touched && form.controls.title.invalid) {
              <small class="field-error">Escribe un título.</small>
            }
          </label>

          <label class="field wide">
            <span>Descripción del daño</span>
            <textarea
              formControlName="description"
              rows="4"
              maxlength="2000"
              placeholder="El agua cae desde el techo cuando el vecino abre la ducha."
            ></textarea>
            @if (form.controls.description.touched && form.controls.description.invalid) {
              <small class="field-error">Describe el daño para que el técnico pueda cotizar.</small>
            }
          </label>

          <!-- Sección de carga de fotos segura -->
          <div class="field wide photos-section">
            <div class="photos-header">
              <span>Fotografías del daño (hasta {{ maxPhotos }})</span>
              <span class="photos-counter">{{ photos().length }} / {{ maxPhotos }}</span>
            </div>

            @if (photos().length < maxPhotos) {
              <div class="file-picker-wrapper">
                <input
                  #fileInput
                  type="file"
                  id="request-photos-input"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  (change)="onFilesSelected($event)"
                  class="hidden-file-input"
                  [disabled]="sending()"
                />
                <label for="request-photos-input" class="file-picker-btn">
                  <span>+ Agregar fotos (JPEG, PNG, WebP ≤ 10MB)</span>
                </label>
              </div>
            }

            @if (photoValidationError()) {
              <small class="field-error">{{ photoValidationError() }}</small>
            }

            @if (photos().length > 0) {
              <ul class="photo-preview-grid">
                @for (item of photos(); track item.id) {
                  <li class="photo-preview-item" [class.error]="item.status === 'ERROR'">
                    <img [src]="item.previewUrl" [alt]="item.file.name" class="preview-img" />
                    <div class="photo-overlay">
                      @if (item.status === 'UPLOADING') {
                        <span class="upload-badge uploading">
                          <span class="spinner"></span>
                          {{ item.stepMessage }}
                        </span>
                      } @else if (item.status === 'READY') {
                        <span class="upload-badge ready">✓ Lista</span>
                      } @else {
                        <div class="error-actions">
                          <span class="upload-badge error-badge">Error</span>
                          <button
                            type="button"
                            class="retry-btn"
                            (click)="retryPhotoUpload(item)"
                            [disabled]="sending()"
                          >
                            Reintentar
                          </button>
                        </div>
                      }
                      <button
                        type="button"
                        class="remove-photo-btn"
                        (click)="removePhoto(item)"
                        [disabled]="sending()"
                        title="Quitar foto"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                }
              </ul>
            }
          </div>

          @if (submitError()) {
            <p class="submit-error">{{ submitError() }}</p>
          }

          @if (submitSuccess()) {
            <p class="submit-success">{{ submitSuccess() }}</p>
          }

          <button
            type="submit"
            class="primary"
            [disabled]="form.invalid || !allPhotosReady() || sending()"
          >
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
            @for (request of requests(); track request.requestId) {
              <li class="row">
                <div class="row-main">
                  <span class="chip">{{ label(request.specialty) }}</span>
                  <span class="row-title">{{ request.title }}</span>
                </div>
                <div class="row-side">
                  <span class="status" [class.assigned]="request.status === 'ASSIGNED'">
                    {{ statusLabel(request.status) }}
                  </span>
                  <a class="cta" [routerLink]="['/quotations/request', request.requestId]">Ver ofertas →</a>
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
    .field-error { color: #b91c1c; font-size: 0.74rem; }
    .submit-error {
      grid-column: 1 / -1; color: #b91c1c; font-size: 0.85rem; margin: 0;
      background: rgba(185, 28, 28, 0.06); border-radius: var(--fixup-radius-md); padding: 0.6rem 0.75rem;
    }
    .submit-success {
      grid-column: 1 / -1; color: #047857; font-size: 0.85rem; margin: 0;
      background: rgba(16, 185, 129, 0.08); border-radius: var(--fixup-radius-md); padding: 0.6rem 0.75rem;
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

    /* Photo uploader styles */
    .photos-section { display: flex; flex-direction: column; gap: 0.5rem; }
    .photos-header { display: flex; justify-content: space-between; align-items: center; font-weight: 600; }
    .photos-counter { font-size: 0.78rem; color: #888; }
    .hidden-file-input { display: none; }
    .file-picker-btn {
      display: inline-block; padding: 0.55rem 0.9rem; border: 1px dashed rgba(154, 148, 141, 0.6);
      border-radius: var(--fixup-radius-md); background: #faf9f6; cursor: pointer;
      font-size: 0.82rem; color: var(--fixup-color-primary); text-align: center;
      transition: background-color 0.15s ease;
    }
    .file-picker-btn:hover { background: #f0ede6; }
    .photo-preview-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: 0.65rem; list-style: none; margin: 0.4rem 0 0 0; padding: 0;
    }
    .photo-preview-item {
      position: relative; width: 100%; aspect-ratio: 1; border-radius: var(--fixup-radius-md);
      overflow: hidden; border: 1px solid rgba(154, 148, 141, 0.3); background: #eee;
    }
    .photo-preview-item.error { border-color: #b91c1c; }
    .preview-img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .photo-overlay {
      position: absolute; inset: 0; background: rgba(0, 0, 0, 0.35);
      display: flex; flex-direction: column; justify-content: space-between; padding: 0.35rem;
    }
    .remove-photo-btn {
      align-self: flex-end; background: rgba(0, 0, 0, 0.65); color: #fff; border: none;
      border-radius: 50%; width: 22px; height: 22px; font-size: 0.72rem; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .remove-photo-btn:hover { background: #b91c1c; }
    .upload-badge {
      font-size: 0.68rem; font-weight: 700; padding: 0.2rem 0.4rem; border-radius: 4px;
      display: inline-flex; align-items: center; gap: 0.25rem; align-self: flex-start;
    }
    .upload-badge.uploading { background: rgba(0, 0, 0, 0.75); color: #fff; }
    .upload-badge.ready { background: #047857; color: #fff; }
    .upload-badge.error-badge { background: #b91c1c; color: #fff; }
    .error-actions { display: flex; flex-direction: column; gap: 0.25rem; }
    .retry-btn {
      background: #fff; color: #b91c1c; border: 1px solid #b91c1c; border-radius: 3px;
      font-size: 0.65rem; font-weight: 700; padding: 0.15rem 0.35rem; cursor: pointer;
    }
    .spinner {
      width: 10px; height: 10px; border: 2px solid #fff; border-top-color: transparent;
      border-radius: 50%; animation: spin 0.8s linear infinite; display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class MyRequestsComponent implements OnInit, OnDestroy {
  private readonly repairRequestApi = inject(RepairRequestControllerService);
  private readonly propertyApi = inject(PropertyControllerService);
  private readonly route = inject(ActivatedRoute);
  private readonly mediaService = inject(RequestMediaService);
  private readonly fb = inject(FormBuilder);

  readonly maxPhotos = MAX_REQUEST_PHOTOS;

  readonly requests = signal<RequestDetailResponse[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly properties = signal<PropertySummary[]>([]);
  readonly propertiesLoading = signal(true);
  readonly propertiesError = signal<string | null>(null);

  readonly photos = signal<RequestPhotoUploadItem[]>([]);
  readonly photoValidationError = signal<string | null>(null);

  readonly sending = signal(false);
  readonly submitError = signal<string | null>(null);
  readonly submitSuccess = signal<string | null>(null);
  private requestedPropertyId: string | null = null;

  readonly form = this.fb.nonNullable.group({
    propertyId: ['', Validators.required],
    title: ['', [Validators.required, Validators.maxLength(150)]],
    description: ['', [Validators.required, Validators.maxLength(2000)]]
  });

  readonly allPhotosReady = computed(() => {
    const list = this.photos();
    return list.every((item) => item.status === 'READY');
  });

  ngOnInit(): void {
    this.requestedPropertyId = this.route.snapshot.queryParamMap.get('propertyId');
    this.load();
    this.loadProperties();
  }

  ngOnDestroy(): void {
    // Revoke any active Object URLs to prevent memory leaks
    this.photos().forEach((item) => {
      try {
        URL.revokeObjectURL(item.previewUrl);
      } catch {
        // ignore
      }
    });
  }

  label(specialty: Specialty): string {
    return specialtyLabel(specialty);
  }

  statusLabel(status: RepairRequestStatus): string {
    return requestStatusLabel(status);
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const selectedFiles = Array.from(input.files);
    input.value = ''; // Reset input so same file can be selected again if desired
    this.photoValidationError.set(null);

    if (this.photos().length + selectedFiles.length > MAX_REQUEST_PHOTOS) {
      this.photoValidationError.set(`Máximo ${MAX_REQUEST_PHOTOS} fotos permitidas en total.`);
      return;
    }

    for (const file of selectedFiles) {
      const validation = this.mediaService.validateFile(file);
      if (!validation.valid) {
        this.photoValidationError.set(validation.error ?? 'Archivo no válido.');
        return;
      }
    }

    const newItems: RequestPhotoUploadItem[] = selectedFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'UPLOADING',
      stepMessage: 'Iniciando…'
    }));

    this.photos.update((curr) => [...curr, ...newItems]);

    // Start upload pipeline for each new item
    newItems.forEach((item) => this.executePhotoUpload(item));
  }

  removePhoto(item: RequestPhotoUploadItem): void {
    try {
      URL.revokeObjectURL(item.previewUrl);
    } catch {
      // ignore
    }
    this.photos.update((curr) => curr.filter((p) => p.id !== item.id));
    this.photoValidationError.set(null);
  }

  retryPhotoUpload(item: RequestPhotoUploadItem): void {
    this.executePhotoUpload(item);
  }

  private executePhotoUpload(item: RequestPhotoUploadItem): void {
    this.updatePhotoItem(item.id, {
      status: 'UPLOADING',
      stepMessage: 'Solicitando ticket…',
      error: undefined
    });

    this.mediaService.requestUploadTicket(item.file).subscribe({
      next: (ticket) => {
        this.updatePhotoItem(item.id, {
          ticket,
          mediaId: ticket.mediaId,
          stepMessage: 'Subiendo imagen…'
        });

        this.mediaService.uploadBinary(ticket, item.file).subscribe({
          next: () => {
            this.updatePhotoItem(item.id, {
              stepMessage: 'Confirmando…'
            });

            this.mediaService.confirmUpload(ticket.mediaId).subscribe({
              next: (confirmRes) => {
                this.updatePhotoItem(item.id, {
                  status: 'READY',
                  mediaId: confirmRes.mediaId,
                  stepMessage: 'Lista'
                });
              },
              error: () => {
                this.updatePhotoItem(item.id, {
                  status: 'ERROR',
                  error: 'Error al confirmar la imagen.',
                  stepMessage: 'Error de confirmación'
                });
              }
            });
          },
          error: () => {
            this.updatePhotoItem(item.id, {
              status: 'ERROR',
              error: 'Error al subir la imagen al almacenamiento.',
              stepMessage: 'Fallo al subir'
            });
          }
        });
      },
      error: () => {
        this.updatePhotoItem(item.id, {
          status: 'ERROR',
          error: 'Error al solicitar el ticket de carga.',
          stepMessage: 'Fallo de ticket'
        });
      }
    });
  }

  private updatePhotoItem(id: string, partial: Partial<RequestPhotoUploadItem>): void {
    this.photos.update((items) =>
      items.map((item) => (item.id === id ? { ...item, ...partial } : item))
    );
  }

  submit(): void {
    if (this.form.invalid || !this.allPhotosReady()) {
      this.form.markAllAsTouched();
      return;
    }

    const { propertyId, title, description } = this.form.getRawValue();
    this.sending.set(true);
    this.submitError.set(null);
    this.submitSuccess.set(null);

    const mediaIds = this.photos()
      .map((p) => p.mediaId)
      .filter((id): id is string => Boolean(id));

    this.repairRequestApi
      .open({
        propertyId,
        title: title.trim(),
        description: description.trim(),
        mediaIds: mediaIds.length > 0 ? mediaIds : undefined
      })
      .subscribe({
        next: (created) => {
          this.requests.update((current) => [created, ...current]);
          // Clean up photo object URLs
          this.photos().forEach((item) => {
            try {
              URL.revokeObjectURL(item.previewUrl);
            } catch {
              // ignore
            }
          });
          this.photos.set([]);
          this.form.reset({ propertyId, title: '', description: '' });
          this.submitSuccess.set(`Solicitud creada. Especialidad detectada: ${specialtyLabel(created.specialty)}`);
          this.sending.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.sending.set(false);
          // Crucial: keep this.photos() intact with confirmed mediaIds, do not re-upload
          this.submitError.set(
            error.status === 403
              ? 'Tu cuenta no puede abrir solicitudes con el rol actual.'
              : error.status === 400
              ? 'Datos de la solicitud inválidos. Revisa el formulario.'
              : 'No pudimos publicar la solicitud. Revisa los datos e intenta de nuevo.'
          );
        }
      });
  }

  private load(): void {
    this.loading.set(true);
    this.repairRequestApi.mine().subscribe({
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

  private loadProperties(): void {
    this.propertiesLoading.set(true);
    // The generated contract advertises */* for this JSON endpoint; request JSON explicitly.
    this.propertyApi.listOwn('body', false, { httpHeaderAccept: 'application/json' } as never).subscribe({
      next: (properties) => {
        this.properties.set(properties);
        this.selectRequestedProperty(properties);
        this.propertiesLoading.set(false);
      },
      error: () => {
        this.propertiesError.set('No pudimos cargar tus propiedades.');
        this.propertiesLoading.set(false);
      }
    });
  }

  private selectRequestedProperty(properties: PropertySummary[]): void {
    if (this.requestedPropertyId === null) {
      return;
    }

    const propertyBelongsToOwner = properties.some((property) => property.id === this.requestedPropertyId);
    this.form.controls.propertyId.setValue(propertyBelongsToOwner ? this.requestedPropertyId : '');
  }
}
