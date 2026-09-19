import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FixerVerificationDocumentType, Specialty } from '../../../../api/generated';
import { FixerVerificationStore } from './fixer-verification.store';

// FR-UC-16: carga de documentos, especialidades y estado de verificación del técnico
@Component({
  selector: 'app-fixer-verification',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [FixerVerificationStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="verification">
      <h1 class="title">Verificación de técnico</h1>
      <p class="subtitle">
        Los archivos se suben directamente al almacenamiento contra una URL firmada. Aquí se
        registra únicamente la clave que devuelve esa subida: el backend nunca recibe el archivo.
      </p>

      @if (store.loading()) {
        <p class="loading-text">Cargando tu estado de verificación…</p>
      } @else if (store.verification(); as verification) {
        <div class="status-row">
          <span class="label">Estado:</span>
          <span class="status-badge" [class]="'status-' + verification.status.toLowerCase()">
            {{ estadoLegible(verification.status) }}
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
              <span class="spec-badge">{{ nombreEspecialidad(esp) }}</span>
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
                  <span>{{ nombreEspecialidad(esp) }}</span>
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

        <div class="documents">
          <div class="document-group">
            <h2>Documentos entregados</h2>
            @for (documento of store.submittedDocuments(); track documento) {
              <span class="doc-badge done">{{ nombreDocumento(documento) }}</span>
            } @empty {
              <span class="empty">Todavía no has entregado documentos.</span>
            }
          </div>

          <div class="document-group">
            <h2>Documentos pendientes</h2>
            @for (documento of store.missingDocuments(); track documento) {
              <span class="doc-badge pending">{{ nombreDocumento(documento) }}</span>
            } @empty {
              <span class="empty">No falta ningún documento obligatorio.</span>
            }
          </div>
        </div>

        @if (!store.verified()) {
          <form class="upload-form" (ngSubmit)="enviar()">
            <h2>Registrar un documento</h2>
            <label for="tipo">Tipo de documento</label>
            <select id="tipo" name="tipo" [(ngModel)]="tipo" required>
              @for (opcion of tiposDisponibles; track opcion) {
                <option [value]="opcion">{{ nombreDocumento(opcion) }}</option>
              }
            </select>

            <label for="clave">Clave de almacenamiento</label>
            <input
              id="clave"
              name="clave"
              type="text"
              maxlength="512"
              placeholder="fixers/verificacion/cedula.pdf"
              [(ngModel)]="claveAlmacenamiento"
              required
            />
            <small class="hint">
              Es la clave que devuelve el almacenamiento tras subir el archivo. Puedes entregar los
              documentos por partes: la revisión se abre sola cuando estén todos los obligatorios.
            </small>

            <button type="submit" class="btn-primary" [disabled]="!puedeEnviar() || store.submitting()">
              {{ store.submitting() ? 'Registrando…' : 'Registrar documento' }}
            </button>
          </form>
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
        border-radius: 12px;
        box-shadow: var(--fixup-shadow-md);
        padding: 2rem;
      }
      .title {
        margin: 0 0 0.5rem;
        font-size: 1.5rem;
      }
      .subtitle,
      .hint {
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
        border-radius: 8px;
      }
      .specialties-section {
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 1.25rem;
        margin-bottom: 1.5rem;
        background: #fbfbfb;
      }
      .specialties-section h2 {
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
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.875rem;
        user-select: none;
      }
      .checkbox-card.selected {
        background: #eff6ff;
        border-color: #3b82f6;
      }
      .documents {
        display: grid;
        gap: 1.25rem;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        margin-bottom: 1.5rem;
      }
      .document-group h2 {
        font-size: 1rem;
        margin: 0 0 0.5rem;
      }
      .doc-badge {
        display: inline-block;
        margin: 0 0.35rem 0.35rem 0;
      }
      .doc-badge.done {
        background: #e0f7e9;
        color: #10693c;
      }
      .doc-badge.pending {
        background: #fff4d6;
        color: #8a6100;
      }
      .empty {
        color: #6b7280;
        font-size: 0.875rem;
      }
      .upload-form {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        border-top: 1px solid #e5e7eb;
        padding-top: 1.5rem;
      }
      .upload-form h2 {
        font-size: 1rem;
        margin: 0 0 0.5rem;
      }
      label {
        font-weight: 600;
        font-size: 0.875rem;
      }
      input,
      select {
        padding: 0.6rem 0.75rem;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font: inherit;
      }
      .btn-primary,
      .btn-secondary {
        margin-top: 0.75rem;
        padding: 0.7rem 1.25rem;
        border: 0;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
      }
      .btn-primary {
        background: var(--fixup-primary, #1d4ed8);
        color: #ffffff;
      }
      .btn-secondary {
        background: #4b5563;
        color: #ffffff;
      }
      .btn-primary:disabled,
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

  readonly tiposDisponibles: FixerVerificationDocumentType[] = [
    'ID_CARD',
    'TRADE_CERTIFICATE',
    'BACKGROUND_CHECK',
    'INSURANCE'
  ];

  readonly especialidadesDisponibles: Specialty[] = [
    Specialty.Plumbing,
    Specialty.Electrical,
    Specialty.Painting,
    Specialty.Carpentry,
    Specialty.Masonry,
    Specialty.General
  ];

  readonly seleccionadas = signal<Specialty[]>([]);

  private readonly tipoState = signal<FixerVerificationDocumentType>('ID_CARD');
  private readonly claveState = signal('');

  constructor() {
    effect(() => {
      const current = this.store.specialties();
      if (current.length > 0 && this.seleccionadas().length === 0) {
        this.seleccionadas.set([...current]);
      }
    });
  }

  get tipo(): FixerVerificationDocumentType {
    return this.tipoState();
  }

  set tipo(valor: FixerVerificationDocumentType) {
    this.tipoState.set(valor);
  }

  get claveAlmacenamiento(): string {
    return this.claveState();
  }

  set claveAlmacenamiento(valor: string) {
    this.claveState.set(valor);
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

  puedeEnviar(): boolean {
    return this.claveState().trim().length > 0;
  }

  enviar(): void {
    if (!this.puedeEnviar()) {
      return;
    }
    this.store.submit([{ type: this.tipoState(), storageKey: this.claveState().trim() }]);
    this.claveState.set('');
  }

  nombreEspecialidad(esp: Specialty): string {
    const nombres: Record<Specialty, string> = {
      PLUMBING: 'Fontanería',
      ELECTRICAL: 'Electricidad',
      PAINTING: 'Pintura',
      CARPENTRY: 'Carpintería',
      MASONRY: 'Albañilería',
      GENERAL: 'Servicios Generales'
    };
    return nombres[esp] ?? esp;
  }

  nombreDocumento(tipo: FixerVerificationDocumentType): string {
    const nombres: Record<string, string> = {
      ID_CARD: 'Documento de identidad',
      TRADE_CERTIFICATE: 'Certificado de oficio',
      BACKGROUND_CHECK: 'Antecedentes',
      INSURANCE: 'Póliza de seguro'
    };
    return nombres[tipo] ?? tipo;
  }

  estadoLegible(estado: string): string {
    const nombres: Record<string, string> = {
      PENDING: 'Pendiente',
      VERIFIED: 'Verificado',
      REJECTED: 'Rechazado',
      SUSPENDED: 'Suspendido'
    };
    return nombres[estado] ?? estado;
  }
}
