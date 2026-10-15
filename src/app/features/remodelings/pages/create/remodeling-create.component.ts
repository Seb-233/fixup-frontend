import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  CreateProjectRequest,
  PropertyControllerService,
  PropertySummary,
  UrgencyLevel,
  PaymentMethod,
  PaymentControllerService,
  OwnerDebtDetail,
  RequirementRequest
} from '../../../../api/generated';
import { RemodelingStore } from '../../services/remodeling.store';
import { RequestMediaService } from '../../../requests/services/request-media.service';
import { MAX_REQUEST_PHOTOS } from '../../../requests/utils/request-ui.helpers';

interface RequirementMediaState {
  uploading: boolean;
  error: string | null;
  mediaIds: string[];
}

@Component({
  selector: 'app-remodeling-create',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="remodeling-create-page">
      <header class="page-header">
        <a routerLink="/remodelings" class="back-link">← Volver a mis remodelaciones</a>
        <h1>Nueva Remodelación</h1>
        <p class="subtitle">Coordina intervenciones multiprofesionales en un solo proyecto.</p>
      </header>

      @if (hasDebt()) {
        <div class="debt-warning-banner" role="alert">
          <div class="debt-banner-content">
            <h2 class="debt-warning-title">Tienes un saldo pendiente</h2>
            <p class="debt-warning-text">
              Debes pagarlo antes de crear un nuevo proyecto de remodelación.
              @if (outstandingDebt(); as debt) {
                <span class="debt-amount">Monto: {{ debt.amount | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</span>
              }
            </p>
          </div>
          <div class="debt-banner-actions">
            <a routerLink="/requests" class="btn btn-primary btn-sm">Ir a mis solicitudes para pagar</a>
          </div>
        </div>
      }

      @if (loadingProperties()) {
        <div class="state-card loading-state">
          <div class="spinner" aria-hidden="true"></div>
          <p>Cargando tus propiedades...</p>
        </div>
      } @else if (propertiesLoadError()) {
        <div class="state-card error-state">
          <p>{{ propertiesLoadError() }}</p>
          <button type="button" (click)="loadProperties()" class="btn btn-secondary">Reintentar</button>
        </div>
      } @else if (properties().length === 0) {
        <div class="state-card empty-state">
          <h2>No tienes propiedades registradas</h2>
          <p>Para crear un proyecto de remodelación primero debes tener al menos un inmueble registrado.</p>
          <a routerLink="/properties" class="btn btn-primary">Registrar una propiedad</a>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" class="project-form">
          <!-- DATOS GENERALES DEL PROYECTO -->
          <fieldset class="form-section">
            <legend class="section-title">Datos del proyecto</legend>

            <div class="field-group">
              <label for="select-property">Inmueble *</label>
              <select id="select-property" formControlName="propertyId" class="form-control">
                <option value="" disabled>Selecciona una propiedad</option>
                @for (prop of properties(); track prop.id) {
                  <option [value]="prop.id">{{ prop.name }} — {{ prop.address }}, {{ prop.city }}</option>
                }
              </select>
              @if (form.controls.propertyId.touched && form.controls.propertyId.invalid) {
                <small class="field-error">Debes seleccionar una propiedad.</small>
              }
            </div>

            <div class="field-group">
              <label for="input-title">Título del proyecto *</label>
              <input
                id="input-title"
                type="text"
                formControlName="title"
                placeholder="Ej. Remodelación integral de cocina y baño principal"
                class="form-control"
                maxlength="150"
              />
              @if (form.controls.title.touched && form.controls.title.invalid) {
                <small class="field-error">El título del proyecto es obligatorio.</small>
              }
            </div>

            <div class="field-group">
              <label for="input-description">Descripción general (opcional)</label>
              <textarea
                id="input-description"
                rows="3"
                formControlName="description"
                placeholder="Describe el alcance global de la obra o consideraciones generales..."
                class="form-control"
                maxlength="2000"
              ></textarea>
            </div>
          </fieldset>

          <!-- LISTA DINÁMICA DE NECESIDADES -->
          <fieldset class="form-section">
            <div class="section-header">
              <div>
                <legend class="section-title">Necesidades del proyecto</legend>
                <p class="section-subtitle">
                  Cada necesidad generará una solicitud de reparación individual clasificada automáticamente por oficio.
                </p>
              </div>
              <button
                type="button"
                (click)="addRequirement()"
                class="btn btn-secondary btn-sm"
                id="btn-add-requirement"
              >
                + Añadir necesidad
              </button>
            </div>

            <div formArrayName="requirements" class="requirements-container">
              @for (reqGroup of requirementsArray.controls; track $index; let idx = $index) {
                <div [formGroupName]="idx" class="requirement-card">
                  <div class="card-top">
                    <span class="requirement-badge">Necesidad {{ idx + 1 }}</span>
                    @if (requirementsArray.length > 1) {
                      <button
                        type="button"
                        (click)="removeRequirement(idx)"
                        class="btn-remove"
                        [attr.aria-label]="'Eliminar necesidad ' + (idx + 1)"
                        title="Eliminar esta necesidad"
                        [disabled]="hasUploadingMedia()"
                      >
                        ✕ Eliminar
                      </button>
                    }
                  </div>

                  <div class="field-group">
                    <label [for]="'req-title-' + idx">Título de la necesidad *</label>
                    <input
                      [id]="'req-title-' + idx"
                      type="text"
                      formControlName="title"
                      placeholder="Ej. Cambio de tubería y grifería"
                      class="form-control"
                      maxlength="150"
                    />
                    @if (reqGroup.get('title')?.touched && reqGroup.get('title')?.invalid) {
                      <small class="field-error">El título de la necesidad es obligatorio.</small>
                    }
                  </div>

                  <div class="field-group">
                    <label [for]="'req-desc-' + idx">Descripción detallada *</label>
                    <textarea
                      [id]="'req-desc-' + idx"
                      rows="3"
                      formControlName="description"
                      placeholder="Describe qué se requiere reparar o remodelar específicamente..."
                      class="form-control"
                      maxlength="2000"
                    ></textarea>
                    @if (reqGroup.get('description')?.touched && reqGroup.get('description')?.invalid) {
                      <small class="field-error">La descripción es obligatoria.</small>
                    }
                  </div>

                  <div class="field-group">
                    <label [for]="'req-urgency-' + idx">Nivel de urgencia</label>
                    <select [id]="'req-urgency-' + idx" formControlName="urgencyLevel" class="form-control">
                      <option [value]="urgencyLevels.Low">Baja</option>
                      <option [value]="urgencyLevels.Medium">Media</option>
                      <option [value]="urgencyLevels.High">Alta</option>
                      <option [value]="urgencyLevels.Urgent">Urgente</option>
                    </select>
                  </div>

                  <div class="field-group">
                    <span class="group-label">Forma de pago *</span>
                    <div class="payment-methods-row">
                      <label class="radio-label">
                        <input
                          type="radio"
                          formControlName="paymentMethod"
                          [value]="paymentMethods.Transfer"
                        />
                        <span>Transferencia</span>
                      </label>
                      <label class="radio-label">
                        <input
                          type="radio"
                          formControlName="paymentMethod"
                          [value]="paymentMethods.Cash"
                        />
                        <span>Efectivo</span>
                      </label>
                    </div>
                    @if (reqGroup.get('paymentMethod')?.touched && reqGroup.get('paymentMethod')?.invalid) {
                      <small class="field-error">Debes seleccionar una forma de pago para esta necesidad.</small>
                    }
                  </div>

                  <!-- SUBIDA DE FOTOS / MEDIOS ASOCIADOS A ESTA NECESIDAD -->
                  <div class="media-section">
                    <span class="media-label">Fotos de soporte (máximo {{ maxPhotos }})</span>

                    <div class="upload-controls">
                      <label [for]="'file-upload-' + idx" class="file-picker-btn" [class.disabled]="mediaState(idx).uploading || mediaState(idx).mediaIds.length >= maxPhotos">
                        {{ mediaState(idx).uploading ? 'Subiendo imagen...' : 'Seleccionar foto' }}
                      </label>
                      <input
                        [id]="'file-upload-' + idx"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        (change)="onFileSelected($event, idx)"
                        [disabled]="mediaState(idx).uploading || mediaState(idx).mediaIds.length >= maxPhotos"
                        class="file-input-hidden"
                      />
                    </div>

                    @if (mediaState(idx).error) {
                      <p class="media-error">{{ mediaState(idx).error }}</p>
                    }

                    @if (mediaState(idx).mediaIds.length > 0) {
                      <div class="media-badges-list">
                        @for (mediaId of mediaState(idx).mediaIds; track mediaId; let mIdx = $index) {
                          <span class="media-chip">
                            Foto {{ mIdx + 1 }}
                            <button
                              type="button"
                              (click)="removeMedia(idx, mIdx)"
                              class="chip-remove-btn"
                              [attr.aria-label]="'Quitar foto ' + (mIdx + 1)"
                            >✕</button>
                          </span>
                        }
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          </fieldset>

          @if (submitError()) {
            <div class="submit-error" role="alert">
              {{ submitError() }}
            </div>
          }

          <div class="form-actions">
            <a routerLink="/remodelings" class="btn btn-secondary">Cancelar</a>
            <button
              type="submit"
              [disabled]="submitting() || form.invalid || hasUploadingMedia() || hasDebt()"
              class="btn btn-primary btn-lg"
              id="btn-submit-remodeling"
            >
              {{ submitting() ? 'Registrando proyecto...' : 'Registrar remodelación' }}
            </button>
          </div>
        </form>
      }
    </section>
  `,
  styles: [`
    .remodeling-create-page {
      max-width: 820px;
      margin: 0 auto;
      padding: 1.5rem 1rem 3.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .page-header {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .back-link {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--fixup-color-accent, #B9975B);
      text-decoration: none;
      margin-bottom: 0.25rem;
    }

    .page-header h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #2D2E31;
      margin: 0;
    }

    .subtitle {
      color: #7A756D;
      font-size: 0.9rem;
      margin: 0;
    }

    .state-card {
      background: #fff;
      border: 1px solid rgba(154, 148, 141, 0.2);
      border-radius: var(--fixup-radius-lg, 12px);
      padding: 2.5rem 1.5rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .spinner {
      width: 30px;
      height: 30px;
      border: 3px solid #e5e0d8;
      border-top-color: var(--fixup-color-accent, #CEAC78);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .project-form {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .form-section {
      background: #fff;
      border: 1px solid rgba(154, 148, 141, 0.2);
      border-radius: var(--fixup-radius-lg, 12px);
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.15rem;
      margin: 0;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .section-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: #2D2E31;
      margin: 0;
      padding: 0;
    }

    .section-subtitle {
      font-size: 0.82rem;
      color: #7A756D;
      margin: 0.25rem 0 0;
    }

    .field-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    .field-group label,
    .field-group .group-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: #4A463F;
    }

    .form-control {
      border: 1px solid rgba(154, 148, 141, 0.35);
      border-radius: var(--fixup-radius-md, 8px);
      padding: 0.65rem 0.8rem;
      font: inherit;
      color: #2D2E31;
      background: #fff;
      transition: border-color 0.15s;
    }

    .form-control:focus {
      outline: none;
      border-color: var(--fixup-color-accent, #CEAC78);
      box-shadow: 0 0 0 2px rgba(206, 172, 120, 0.2);
    }

    .field-error {
      color: #b91c1c;
      font-size: 0.8rem;
    }

    .requirements-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .requirement-card {
      background: #faf9f6;
      border: 1px solid #efece5;
      border-radius: var(--fixup-radius-md, 8px);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
    }

    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .requirement-badge {
      font-size: 0.85rem;
      font-weight: 700;
      color: #2D2E31;
      background: #eee8dc;
      padding: 0.25rem 0.65rem;
      border-radius: 4px;
    }

    .btn-remove {
      background: transparent;
      border: 0;
      color: #b91c1c;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      padding: 0.2rem 0.4rem;
    }
    .btn-remove:hover {
      text-decoration: underline;
    }

    .media-section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px dashed #e3ddd3;
    }

    .media-label {
      font-size: 0.82rem;
      font-weight: 600;
      color: #5d5952;
    }

    .file-input-hidden {
      display: none;
    }

    .file-picker-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      padding: 0.45rem 0.9rem;
      background: #fff;
      border: 1px dashed #CEAC78;
      border-radius: 6px;
      font-size: 0.82rem;
      font-weight: 600;
      color: #4A463F;
      cursor: pointer;
      transition: all 0.2s ease;
      width: fit-content;
    }
    .file-picker-btn:hover:not(.disabled) {
      background: #fbf8f2;
      border-color: #B9975B;
    }
    .file-picker-btn.disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .media-error {
      color: #b91c1c;
      font-size: 0.8rem;
      margin: 0;
    }

    .media-badges-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .media-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
      border-radius: 999px;
      padding: 0.2rem 0.6rem;
      font-size: 0.78rem;
      font-weight: 600;
    }

    .chip-remove-btn {
      background: transparent;
      border: 0;
      color: #065f46;
      cursor: pointer;
      font-size: 0.75rem;
      padding: 0;
      line-height: 1;
    }

    .submit-error {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
      border-radius: 8px;
      padding: 0.85rem 1.1rem;
      font-size: 0.88rem;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 1rem;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.65rem 1.25rem;
      border-radius: var(--fixup-radius-md, 8px);
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.2s ease;
      border: 0;
    }

    .payment-methods-row {
      display: flex;
      gap: 1.5rem;
      margin-top: 0.2rem;
    }
    .radio-label {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.88rem;
      color: #2D2E31;
      cursor: pointer;
    }
    .debt-warning-banner {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: var(--fixup-radius-lg, 12px);
      padding: 1.1rem 1.25rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .debt-warning-title {
      font-size: 1rem;
      font-weight: 700;
      color: #991b1b;
      margin: 0 0 0.25rem 0;
    }
    .debt-warning-text {
      color: #7f1d1d;
      font-size: 0.85rem;
      margin: 0;
    }
    .debt-amount {
      display: block;
      font-weight: 700;
      margin-top: 0.2rem;
    }
    .btn-sm {
      padding: 0.4rem 0.85rem;
      font-size: 0.82rem;
    }

    .btn-lg {
      padding: 0.8rem 1.6rem;
      font-size: 0.95rem;
    }

    .btn-primary {
      background: var(--fixup-color-primary, #2D2E31);
      color: #fff;
    }
    .btn-primary:hover:not(:disabled) {
      opacity: 0.92;
    }
    .btn-primary:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #f1ede6;
      color: #4A463F;
      border: 1px solid #ddd7cd;
    }
  `]
})
export class RemodelingCreateComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly propertyApi = inject(PropertyControllerService);
  private readonly paymentsApi = inject(PaymentControllerService);
  private readonly remodelingStore = inject(RemodelingStore);
  private readonly mediaService = inject(RequestMediaService);
  private readonly router = inject(Router);

  readonly urgencyLevels = UrgencyLevel;
  readonly maxPhotos = MAX_REQUEST_PHOTOS;
  readonly paymentMethods = PaymentMethod;

  readonly properties = signal<PropertySummary[]>([]);
  readonly loadingProperties = signal<boolean>(true);
  readonly propertiesLoadError = signal<string | null>(null);

  readonly debts = signal<OwnerDebtDetail[]>([]);
  readonly outstandingDebt = computed(() =>
    this.debts().find((d) => d.status === 'OUTSTANDING')
  );
  readonly hasDebt = computed(() => !!this.outstandingDebt());

  readonly submitting = signal<boolean>(false);
  readonly submitError = signal<string | null>(null);

  // Array de estados de media para cada necesidad
  private readonly mediaStates = signal<RequirementMediaState[]>([
    { uploading: false, error: null, mediaIds: [] }
  ]);

  readonly form = this.fb.group({
    propertyId: ['', Validators.required],
    title: ['', [Validators.required, Validators.maxLength(150)]],
    description: ['', Validators.maxLength(2000)],
    requirements: this.fb.array([this.createRequirementGroup()])
  });

  get requirementsArray(): FormArray<FormGroup> {
    return this.form.get('requirements') as FormArray<FormGroup>;
  }

  mediaState(index: number): RequirementMediaState {
    return this.mediaStates()[index] ?? { uploading: false, error: null, mediaIds: [] };
  }

  ngOnInit(): void {
    this.loadProperties();
    this.loadDebts();
  }

  loadProperties(): void {
    this.loadingProperties.set(true);
    this.propertiesLoadError.set(null);

    this.propertyApi.listOwn('body', false, { httpHeaderAccept: 'application/json' } as never).subscribe({
      next: (props) => {
        this.properties.set(props);
        this.loadingProperties.set(false);
      },
      error: () => {
        this.propertiesLoadError.set('No pudimos cargar tus propiedades.');
        this.loadingProperties.set(false);
      }
    });
  }

  loadDebts(): void {
    this.paymentsApi.debts().subscribe({
      next: (debts) => this.debts.set(debts),
      error: () => this.debts.set([])
    });
  }

  private createRequirementGroup(): FormGroup {
    return this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(150)]],
      description: ['', [Validators.required, Validators.maxLength(2000)]],
      urgencyLevel: [UrgencyLevel.Medium, Validators.required],
      paymentMethod: [null as PaymentMethod | null, Validators.required]
    });
  }

  addRequirement(): void {
    this.requirementsArray.push(this.createRequirementGroup());
    this.mediaStates.update((states) => [
      ...states,
      { uploading: false, error: null, mediaIds: [] }
    ]);
  }

  removeRequirement(index: number): void {
    if (this.requirementsArray.length <= 1 || this.hasUploadingMedia()) return;
    this.requirementsArray.removeAt(index);
    this.mediaStates.update((states) => states.filter((_, i) => i !== index));
  }

  onFileSelected(event: Event, reqIndex: number): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    input.value = ''; // Reset input to allow selecting same file again if desired

    const validation = this.mediaService.validateFile(file);
    if (!validation.valid) {
      this.updateMediaState(reqIndex, { error: validation.error ?? 'Archivo inválido.' });
      return;
    }

    if (this.mediaState(reqIndex).mediaIds.length >= this.maxPhotos) {
      this.updateMediaState(reqIndex, { error: `Máximo ${this.maxPhotos} fotos por necesidad.` });
      return;
    }

    this.updateMediaState(reqIndex, { uploading: true, error: null });

    this.mediaService.requestUploadTicket(file).subscribe({
      next: (ticket) => {
        this.mediaService.uploadBinary(ticket, file).subscribe({
          next: () => {
            this.mediaService.confirmUpload(ticket.mediaId).subscribe({
              next: (confirmed) => {
                this.updateMediaState(reqIndex, {
                  uploading: false,
                  error: null,
                  mediaIds: [...this.mediaState(reqIndex).mediaIds, confirmed.mediaId]
                });
              },
              error: () => {
                this.updateMediaState(reqIndex, {
                  uploading: false,
                  error: 'Error al confirmar la imagen en el servidor.'
                });
              }
            });
          },
          error: () => {
            this.updateMediaState(reqIndex, {
              uploading: false,
              error: 'Error al subir la imagen al almacenamiento.'
            });
          }
        });
      },
      error: () => {
        this.updateMediaState(reqIndex, {
          uploading: false,
          error: 'Error al solicitar el ticket de subida.'
        });
      }
    });
  }

  removeMedia(reqIndex: number, mediaIndex: number): void {
    const current = this.mediaState(reqIndex);
    const updated = current.mediaIds.filter((_, idx) => idx !== mediaIndex);
    this.updateMediaState(reqIndex, { mediaIds: updated });
  }

  private updateMediaState(reqIndex: number, partial: Partial<RequirementMediaState>): void {
    this.mediaStates.update((states) => {
      const copy = [...states];
      if (copy[reqIndex]) {
        copy[reqIndex] = { ...copy[reqIndex], ...partial };
      }
      return copy;
    });
  }

  hasUploadingMedia(): boolean {
    return this.mediaStates().some((state) => state.uploading);
  }

  submit(): void {
    if (this.hasDebt()) {
      this.submitError.set('Tienes un saldo pendiente. Debes pagarlo antes de crear un nuevo proyecto de remodelación.');
      return;
    }

    if (this.form.invalid || this.hasUploadingMedia()) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const requirements: RequirementRequest[] = (raw.requirements || []).map((req, idx) => ({
      title: (req['title'] as string | undefined)?.trim() ?? '',
      description: (req['description'] as string | undefined)?.trim() ?? '',
      urgencyLevel: (req['urgencyLevel'] as UrgencyLevel | undefined) ?? UrgencyLevel.Medium,
      paymentMethod: req['paymentMethod'] as PaymentMethod,
      mediaIds: this.mediaState(idx).mediaIds
    }));

    const payload: CreateProjectRequest = {
      propertyId: raw.propertyId ?? '',
      title: raw.title?.trim() ?? '',
      description: raw.description?.trim() ? raw.description.trim() : undefined,
      requirements
    };

    this.submitting.set(true);
    this.submitError.set(null);

    this.remodelingStore.createProject(payload).subscribe({
      next: (created) => {
        this.submitting.set(false);
        this.router.navigate(['/remodelings', created.id]);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        if (err.status === 409 || err.error?.code === 'OWNER_HAS_OUTSTANDING_DEBT') {
          this.loadDebts();
          this.submitError.set('Tienes un saldo pendiente. Debes pagarlo antes de crear un nuevo proyecto de remodelación.');
        } else if (err.status === 400) {
          this.submitError.set('Los datos de la remodelación son inválidos. Revisa todos los campos.');
        } else if (err.status === 403) {
          this.submitError.set('No tienes permiso para registrar proyectos de remodelación.');
        } else {
          this.submitError.set('No pudimos registrar la remodelación. Intenta nuevamente.');
        }
      }
    });
  }
}
