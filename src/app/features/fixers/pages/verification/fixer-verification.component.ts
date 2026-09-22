import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FixerVerificationDocumentType, Specialty } from '../../../../api/generated';
import { FixerVerificationStore } from './fixer-verification.store';
import {
  CONSENT_VERSION,
  VERIFICATION_DOCUMENT_TYPES,
  fixerSpecialtyLabel,
  validateVerificationFile,
  verificationStatusLabel
} from '../../utils/fixer-verification-ui.helpers';

/**
 * FR-UC-23 — Verificación de identidad del Fixer (lado del técnico).
 *
 * Pantalla donde un Fixer autenticado sube sus documentos de identidad/oficio, elige sus
 * especialidades y sigue el estado de su verificación. Es puramente presentacional: toda la
 * orquestación HTTP (incluida la subida en varios pasos de cada documento) vive en
 * {@link FixerVerificationStore}, inyectado como provider de este componente porque su estado
 * solo tiene sentido mientras esta pantalla está montada.
 *
 * Decisión de diseño clave: por cada tipo de documento se muestra un `<input type="file">`
 * independiente que dispara de inmediato el flujo de subida al elegir un archivo (no hay un
 * botón "enviar" separado). Esto reemplaza el diseño anterior, en el que el Fixer escribía a
 * mano una "clave de almacenamiento" de texto libre — un campo que asumía que el archivo ya
 * existía en el almacenamiento por algún medio externo no modelado por esta pantalla. El
 * contrato actual del backend exige en cambio un `mediaId` ya confirmado por
 * `POST /media/uploads/{mediaId}/confirm`, así que la pantalla tiene que ser quien dispare esa
 * subida, no solo registrar una clave que alguien más subió.
 *
 * Limitación conocida y deliberada — solo imágenes, sin PDF: el módulo `media` del backend
 * (compartido con el portafolio del Fixer y las fotos de solicitudes) solo admite
 * `image/jpeg`, `image/png` y `image/webp`, tanto en el filtro de `Content-Type` de
 * `RequestUploadTicket` como en la verificación real de magic bytes de `confirmUpload`
 * (`MediaContentTypeValidator`, sin caso para PDF). Un documento de identidad o certificado en
 * PDF sería rechazado por el backend (415, o purgado como `INVALID` si el `Content-Type` se
 * falseara), así que el `accept` del `<input type="file">` de abajo se mantiene limitado a
 * imágenes a propósito: ampliarlo dejaría elegir un archivo que el backend rechazará seguro.
 * Soportar PDF requeriría cambiar `MediaContentTypeValidator` (compartido por los tres módulos
 * que lo usan), no solo esta pantalla. Registrado como hallazgo de riesgo técnico para el SAD,
 * no se resuelve en este cambio.
 */
@Component({
  selector: 'app-fixer-verification',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="verification">
      <h1 class="title">Verificación de técnico</h1>
      <p class="subtitle">
        Cada archivo se sube directamente al almacenamiento contra una URL firmada de un solo
        uso: el backend de FixUp nunca recibe el contenido del documento, solo confirma que la
        subida terminó y quedó validada.
      </p>

      @if (store.loading()) {
        <p class="loading-text">Cargando tu estado de verificación…</p>
      } @else if (store.verification(); as verification) {
        <div class="status-row">
          <span class="label">Estado:</span>
          <span class="status-badge" [class]="'status-' + verification.status.toLowerCase()">
            {{ statusLabel(verification.status) }}
          </span>
          @if (store.underReview()) {
            <span class="review-badge">En revisión</span>
          }
        </div>

        @if (verification.rejectionReason) {
          <p class="rejection" role="alert">
            Motivo del rechazo: {{ verification.rejectionReason }}
          </p>
        }

        <!-- Especialidades del Fixer -->
        <div class="specialties-section">
          <h2>Especialidades de servicio</h2>
          <div class="current-specialties">
            @for (esp of store.specialties(); track esp) {
              <span class="spec-badge">{{ specialtyLabel(esp) }}</span>
            } @empty {
              <span class="empty">No tienes especialidades configuradas. Debes seleccionar al menos una.</span>
            }
          </div>

          <form class="specialties-form" (ngSubmit)="guardarEspecialidades()">
            <p class="label-heading">Seleccionar especialidades que atiendes:</p>
            <div class="specialties-grid">
              @for (esp of especialidadesDisponibles; track esp) {
                <label class="checkbox-card" [class.selected]="estaSeleccionada(esp)">
                  <input
                    type="checkbox"
                    [value]="esp"
                    [checked]="estaSeleccionada(esp)"
                    (change)="alternarEspecialidad(esp)"
                  />
                  <span>{{ specialtyLabel(esp) }}</span>
                </label>
              }
            </div>

            <button
              type="submit"
              class="btn-secondary"
              [disabled]="seleccionadas().length === 0 || store.submitting()"
            >
              {{ store.submitting() ? 'Guardando…' : 'Actualizar especialidades' }}
            </button>
          </form>
        </div>

        @if (!store.verified()) {
          <!-- Consentimiento de tratamiento de datos: se envía junto con cada documento que se
               archiva; el backend solo lo exige de verdad la vez en que el conjunto obligatorio
               queda completo y todavía no hay un consentimiento registrado (ver store). -->
          <label class="consent-row">
            <input
              type="checkbox"
              [checked]="consentAccepted()"
              (change)="alternarConsentimiento($event)"
            />
            <span>
              Acepto que FixUp trate mis documentos de identidad con fines de verificación
              (versión {{ consentVersion }}).
            </span>
          </label>
        }

        <!-- Documentos: una fila por tipo, con su propio input de archivo y su propio progreso -->
        <div class="documents">
          <h2>Documentos de verificación</h2>
          <ul class="doc-list">
            @for (doc of documentTypes; track doc.type) {
              <li class="doc-row" [class.done]="estaEntregado(doc.type)">
                <div class="doc-info">
                  <span class="doc-name">{{ doc.label }}</span>
                  <span class="doc-tag" [class.required]="doc.required">
                    {{ doc.required ? 'Obligatorio' : 'Opcional' }}
                  </span>
                </div>

                <span class="doc-badge" [class.done]="estaEntregado(doc.type)" [class.pending]="!estaEntregado(doc.type)">
                  {{ estaEntregado(doc.type) ? 'Entregado' : 'Pendiente' }}
                </span>

                @if (!store.verified()) {
                  <div class="doc-action">
                    @if (store.uploadingType() === doc.type) {
                      <span class="upload-progress">
                        <span class="spinner"></span>
                        {{ store.uploadStep() }}
                      </span>
                    } @else {
                      <label
                        class="file-picker-btn"
                        [class.disabled]="store.uploadingType() !== null"
                      >
                        {{ estaEntregado(doc.type) ? 'Reemplazar archivo' : 'Subir archivo' }}
                        <!-- Sin PDF a propósito: el backend (MediaContentTypeValidator, módulo
                             media compartido) solo valida JPEG/PNG/WebP hoy. Ver JSDoc de la
                             clase — es una limitación conocida, no un descuido. -->
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          class="hidden-file-input"
                          [disabled]="store.uploadingType() !== null"
                          (change)="onFileSelected(doc.type, $event)"
                        />
                      </label>
                    }
                  </div>
                }
              </li>
            }
          </ul>
        </div>

        @if (fileValidationError(); as mensaje) {
          <p class="error" role="alert">{{ mensaje }}</p>
        }
        @if (store.uploadError(); as mensaje) {
          <p class="error" role="alert">{{ mensaje }}</p>
        }
      }

      @if (store.error(); as mensaje) {
        <p class="error" role="alert">{{ mensaje }}</p>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 2rem 1rem;
      }
      .verification {
        max-width: 720px;
        margin: 0 auto;
        background: #ffffff;
        border-radius: var(--fixup-radius-lg);
        box-shadow: var(--fixup-shadow-md);
        padding: 2rem;
      }
      .title {
        font-family: var(--fixup-font-heading);
        color: var(--fixup-color-primary);
        margin: 0 0 0.5rem;
        font-size: 1.5rem;
      }
      .subtitle {
        color: #5b6472;
        font-size: 0.875rem;
      }
      .status-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin: 1.5rem 0;
      }
      .status-badge,
      .review-badge,
      .doc-badge,
      .spec-badge {
        border-radius: 999px;
        padding: 0.25rem 0.75rem;
        font-size: 0.8125rem;
        font-weight: 600;
      }
      .status-pending {
        background: #fff4d6;
        color: #8a6100;
      }
      .status-verified {
        background: #e0f7e9;
        color: #10693c;
      }
      .status-rejected {
        background: #fde8e8;
        color: #9b1c1c;
      }
      .status-suspended {
        background: #eceff3;
        color: #4b5563;
      }
      .review-badge {
        background: #e5efff;
        color: #1d4ed8;
      }
      .rejection {
        background: #fde8e8;
        color: #9b1c1c;
        padding: 0.75rem 1rem;
        border-radius: var(--fixup-radius-md);
      }
      .specialties-section {
        border: 1px solid #e5e7eb;
        border-radius: var(--fixup-radius-md);
        padding: 1.25rem;
        margin-bottom: 1.5rem;
        background: #fbfbfb;
      }
      .specialties-section h2,
      .documents h2 {
        font-family: var(--fixup-font-heading);
        color: var(--fixup-color-primary);
        font-size: 1rem;
        margin: 0 0 0.75rem;
      }
      .current-specialties {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }
      .spec-badge {
        background: #eef2ff;
        color: #3730a3;
        border: 1px solid #c7d2fe;
      }
      .specialties-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 0.5rem;
        margin: 0.5rem 0 1rem;
      }
      .label-heading {
        font-weight: 500;
        font-size: 0.875rem;
        margin: 0 0 0.5rem;
        color: #374151;
      }
      .checkbox-card {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 0.75rem;
        background: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: var(--fixup-radius-md);
        cursor: pointer;
        font-size: 0.875rem;
        user-select: none;
      }
      .checkbox-card.selected {
        background: #eff6ff;
        border-color: #3b82f6;
      }
      .consent-row {
        display: flex;
        align-items: flex-start;
        gap: 0.6rem;
        background: #fbfbfb;
        border: 1px solid #e5e7eb;
        border-radius: var(--fixup-radius-md);
        padding: 0.85rem 1rem;
        margin-bottom: 1.25rem;
        font-size: 0.85rem;
        color: #374151;
        cursor: pointer;
      }
      .consent-row input {
        margin-top: 0.15rem;
      }
      .documents h2 {
        margin-bottom: 0.85rem;
      }
      .doc-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
      }
      .doc-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        flex-wrap: wrap;
        padding: 0.75rem 0.9rem;
        background: #faf9f6;
        border: 1px solid #efece5;
        border-radius: var(--fixup-radius-md);
      }
      .doc-row.done {
        border-color: rgba(16, 185, 129, 0.4);
      }
      .doc-info {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-width: 0;
      }
      .doc-name {
        font-weight: 600;
        color: var(--fixup-color-primary);
        font-size: 0.9rem;
      }
      .doc-tag {
        font-size: 0.68rem;
        font-weight: 700;
        border-radius: 4px;
        padding: 0.1rem 0.4rem;
        background: #eceff3;
        color: #4b5563;
      }
      .doc-tag.required {
        background: #fde8e8;
        color: #9b1c1c;
      }
      .doc-badge.done {
        background: #e0f7e9;
        color: #10693c;
      }
      .doc-badge.pending {
        background: #fff4d6;
        color: #8a6100;
      }
      .doc-action {
        margin-left: auto;
      }
      .hidden-file-input {
        display: none;
      }
      .file-picker-btn {
        display: inline-block;
        padding: 0.45rem 0.85rem;
        border: 1px dashed rgba(154, 148, 141, 0.6);
        border-radius: var(--fixup-radius-md);
        background: #ffffff;
        cursor: pointer;
        font-size: 0.8rem;
        font-weight: 600;
        color: var(--fixup-color-primary);
      }
      .file-picker-btn:hover {
        background: #f0ede6;
      }
      .file-picker-btn.disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .upload-progress {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.78rem;
        color: #4b5563;
        font-weight: 600;
      }
      .spinner {
        width: 12px;
        height: 12px;
        border: 2px solid var(--fixup-color-primary);
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        display: inline-block;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      .empty {
        color: #6b7280;
        font-size: 0.875rem;
      }
      label {
        font-weight: 600;
        font-size: 0.875rem;
      }
      .btn-primary,
      .btn-secondary {
        margin-top: 0.75rem;
        padding: 0.7rem 1.25rem;
        border: 0;
        border-radius: var(--fixup-radius-md);
        font-weight: 600;
        cursor: pointer;
      }
      .btn-secondary {
        background: #4b5563;
        color: #ffffff;
      }
      .btn-secondary:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .error {
        margin-top: 1rem;
        color: #9b1c1c;
      }
    `
  ]
})
export class FixerVerificationComponent implements OnInit {
  readonly store = inject(FixerVerificationStore);

  readonly documentTypes = VERIFICATION_DOCUMENT_TYPES;
  readonly consentVersion = CONSENT_VERSION;

  readonly especialidadesDisponibles: Specialty[] = [
    Specialty.Plumbing,
    Specialty.Electrical,
    Specialty.Painting,
    Specialty.Carpentry,
    Specialty.Masonry,
    Specialty.General
  ];

  readonly seleccionadas = signal<Specialty[]>([]);
  readonly consentAccepted = signal(false);
  readonly fileValidationError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const current = this.store.specialties();
      if (current.length > 0 && this.seleccionadas().length === 0) {
        this.seleccionadas.set([...current]);
      }
    });
  }

  ngOnInit(): void {
    this.store.load();
  }

  estaSeleccionada(esp: Specialty): boolean {
    return this.seleccionadas().includes(esp);
  }

  alternarEspecialidad(esp: Specialty): void {
    const list = this.seleccionadas();
    if (list.includes(esp)) {
      this.seleccionadas.set(list.filter((s) => s !== esp));
    } else {
      this.seleccionadas.set([...list, esp]);
    }
  }

  guardarEspecialidades(): void {
    const specs = this.seleccionadas();
    if (specs.length === 0) return;
    this.store.updateSpecialties(specs);
  }

  alternarConsentimiento(event: Event): void {
    this.consentAccepted.set((event.target as HTMLInputElement).checked);
  }

  estaEntregado(type: FixerVerificationDocumentType): boolean {
    return this.store.submittedDocuments().includes(type);
  }

  /**
   * Dispara el flujo de subida de tres pasos para el archivo recién elegido en la fila de
   * `type`. Valida primero en el cliente (formato/tamaño) para ahorrar una llamada de red que
   * fallaría seguro; la validación real y definitiva sigue siendo la del backend.
   */
  onFileSelected(type: FixerVerificationDocumentType, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    // Limpiar el input de inmediato para poder volver a elegir el mismo archivo si algo falla.
    input.value = '';
    if (!file) {
      return;
    }

    const validation = validateVerificationFile(file);
    if (!validation.valid) {
      this.fileValidationError.set(validation.error ?? 'Archivo no válido.');
      return;
    }

    this.fileValidationError.set(null);
    this.store.uploadDocument(type, file, this.consentAccepted() ? this.consentVersion : undefined);
  }

  specialtyLabel(esp: Specialty): string {
    return fixerSpecialtyLabel(esp);
  }

  statusLabel(estado: string): string {
    return verificationStatusLabel(estado);
  }
}
