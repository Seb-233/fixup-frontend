import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import {
  FixerVerificationControllerService,
  FixerVerificationDocumentType,
  ReviewResponse,
  Specialty
} from '../../../../api/generated';

// Etiquetas locales, deliberadamente NO importadas desde
// `features/fixers/utils/fixer-verification-ui.helpers.ts`: las features no deben importar
// archivos internos de otra feature (docs/architecture/frontend-architecture.md, sección 5).
// Esta pantalla vive en "administration", la de subida vive en "fixers"; se acepta duplicar
// estos mapas de ~6 líneas en vez de romper el aislamiento entre features.
const DOCUMENT_LABELS: Record<FixerVerificationDocumentType, string> = {
  ID_CARD: 'Documento de identidad',
  TRADE_CERTIFICATE: 'Certificado de oficio',
  BACKGROUND_CHECK: 'Antecedentes',
  INSURANCE: 'Póliza de seguro'
};

const SPECIALTY_LABELS: Record<Specialty, string> = {
  PLUMBING: 'Fontanería',
  ELECTRICAL: 'Electricidad',
  PAINTING: 'Pintura',
  CARPENTRY: 'Carpintería',
  MASONRY: 'Albañilería',
  GENERAL: 'Servicios Generales'
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  VERIFIED: 'Verificado',
  REJECTED: 'Rechazado',
  SUSPENDED: 'Suspendido'
};

/**
 * FR-UC-23 — Verificación de identidad del Fixer (lado del administrador).
 *
 * Permite a un PLATFORM_ADMIN aprobar o rechazar la verificación de un Fixer, viendo primero la
 * evidencia real: sus documentos (como URLs firmadas de lectura, nunca la clave de
 * almacenamiento ni el archivo en sí), sus especialidades declaradas y el estado actual de su
 * perfil.
 *
 * Por qué existe esta pantalla y no una versión más simple: la versión anterior dejaba que el
 * administrador aprobara o rechazara pegando a mano el UUID del Fixer, sin ver nada de lo que
 * estaba decidiendo — una aprobación a ciegas. Esta versión introduce un paso de carga explícito
 * (`GET /fixers/{fixerUserId}/verification`, operación `reviewOf`) y solo habilita los botones
 * de decisión una vez que esa carga terminó y el perfil realmente tiene una entrega esperando
 * revisión (`underReview`); decidir sobre un perfil que no está en revisión es un 409
 * `NOT_UNDER_REVIEW` en el backend, así que replicar esa condición en el frontend evita un viaje
 * de red que fallaría seguro y, sobre todo, evita que el botón parezca accionable cuando no lo es.
 */
@Component({
  selector: 'app-fixer-review',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="review">
      <h1 class="title">Revisión de técnicos</h1>
      <p class="subtitle">
        La decisión exige rol de administrador vigente en el backend. Un administrador no puede
        decidir su propia verificación.
      </p>

      <label for="fixer">Identificador interno del técnico</label>
      <div class="search-row">
        <input
          id="fixer"
          name="fixer"
          type="text"
          placeholder="00000000-0000-0000-0000-000000000000"
          [(ngModel)]="fixerUserId"
        />
        <button
          type="button"
          class="btn-search"
          [disabled]="!puedeBuscar()"
          (click)="cargarRevision()"
        >
          {{ loadingReview() ? 'Cargando…' : 'Cargar revisión' }}
        </button>
      </div>

      @if (reviewError(); as mensaje) {
        <p class="error" role="alert">{{ mensaje }}</p>
      }

      @if (review(); as data) {
        <!-- Evidencia cargada: recién a partir de aquí tiene sentido decidir algo -->
        <div class="review-panel">
          <div class="status-row">
            <span class="label">Estado:</span>
            <span class="status-badge" [class]="'status-' + data.status.toLowerCase()">
              {{ statusLabel(data.status) }}
            </span>
            @if (data.underReview) {
              <span class="review-badge">Esperando decisión</span>
            } @else {
              <span class="idle-badge">Sin entrega pendiente de decisión</span>
            }
          </div>

          @if (data.rejectionReason) {
            <p class="rejection">Motivo del último rechazo: {{ data.rejectionReason }}</p>
          }

          <div class="section">
            <h2>Especialidades declaradas</h2>
            <div class="chips">
              @for (esp of specialtiesOf(data); track esp) {
                <span class="spec-badge">{{ specialtyLabel(esp) }}</span>
              } @empty {
                <span class="empty">No declaró especialidades.</span>
              }
            </div>
          </div>

          <div class="section">
            <h2>Documentos entregados</h2>
            @if (data.documents.length === 0) {
              <p class="empty">No hay documentos entregados todavía.</p>
            } @else {
              <ul class="doc-list">
                @for (doc of data.documents; track doc.mediaId) {
                  <li class="doc-row">
                    <span class="doc-name">{{ documentLabel(doc.type) }}</span>
                    <a class="doc-link" [href]="doc.readUrl" target="_blank" rel="noopener noreferrer">
                      Ver documento ↗
                    </a>
                  </li>
                }
              </ul>
              <p class="hint">
                Los enlaces son URLs firmadas de lectura con vigencia corta; si expiran, vuelve a
                cargar la revisión para obtener enlaces nuevos.
              </p>
            }
          </div>
        </div>
      }

      <label for="motivo">Motivo del rechazo</label>
      <textarea
        id="motivo"
        name="motivo"
        rows="3"
        maxlength="500"
        placeholder="Obligatorio solo para rechazar"
        [(ngModel)]="motivo"
      ></textarea>

      <div class="actions">
        <button type="button" class="btn-approve" [disabled]="!puedeDecidir()" (click)="aprobar()">
          Aprobar
        </button>
        <button type="button" class="btn-reject" [disabled]="!puedeRechazar()" (click)="rechazar()">
          Rechazar
        </button>
      </div>

      @if (procesando()) {
        <p class="loading-text">Enviando la decisión…</p>
      }
      @if (exito(); as mensaje) {
        <p class="ok" role="status">{{ mensaje }}</p>
      }
      @if (error(); as mensaje) {
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
      .review {
        max-width: 640px;
        margin: 0 auto;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        background: #ffffff;
        border-radius: var(--fixup-radius-lg);
        box-shadow: var(--fixup-shadow-md);
        padding: 2rem;
      }
      .title {
        font-family: var(--fixup-font-heading);
        color: var(--fixup-color-primary);
        margin: 0;
        font-size: 1.5rem;
      }
      .subtitle {
        color: #5b6472;
        font-size: 0.875rem;
        margin: 0 0 1rem;
      }
      label {
        font-weight: 600;
        font-size: 0.875rem;
      }
      input,
      textarea {
        padding: 0.6rem 0.75rem;
        border: 1px solid #d1d5db;
        border-radius: var(--fixup-radius-md);
        font: inherit;
      }
      .search-row {
        display: flex;
        gap: 0.6rem;
        align-items: stretch;
      }
      .search-row input {
        flex: 1;
      }
      .btn-search {
        padding: 0 1rem;
        border: 0;
        border-radius: var(--fixup-radius-md);
        background: var(--fixup-color-primary);
        color: #fff;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
      }
      .btn-search:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .review-panel {
        border: 1px solid #e5e7eb;
        border-radius: var(--fixup-radius-md);
        padding: 1.1rem 1.25rem;
        background: #fbfbfb;
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
      }
      .status-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
      .status-badge,
      .review-badge,
      .idle-badge,
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
      .idle-badge {
        background: #eceff3;
        color: #4b5563;
      }
      .rejection {
        background: #fde8e8;
        color: #9b1c1c;
        padding: 0.6rem 0.85rem;
        border-radius: var(--fixup-radius-md);
        margin: 0;
        font-size: 0.85rem;
      }
      .section h2 {
        font-size: 0.9rem;
        margin: 0 0 0.5rem;
        color: var(--fixup-color-primary);
      }
      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      .spec-badge {
        background: #eef2ff;
        color: #3730a3;
        border: 1px solid #c7d2fe;
      }
      .doc-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }
      .doc-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
        padding: 0.5rem 0.7rem;
        background: #ffffff;
        border: 1px solid #efece5;
        border-radius: var(--fixup-radius-md);
      }
      .doc-name {
        font-size: 0.85rem;
        font-weight: 600;
        color: #374151;
      }
      .doc-link {
        font-size: 0.8rem;
        font-weight: 700;
        color: var(--fixup-color-primary);
        text-decoration: none;
      }
      .doc-link:hover {
        text-decoration: underline;
      }
      .hint {
        color: #6b7280;
        font-size: 0.75rem;
        margin: 0.4rem 0 0;
      }
      .empty {
        color: #6b7280;
        font-size: 0.85rem;
        margin: 0;
      }
      .actions {
        display: flex;
        gap: 0.75rem;
        margin-top: 1rem;
      }
      button {
        flex: 1;
        padding: 0.7rem 1rem;
        border: 0;
        border-radius: var(--fixup-radius-md);
        font-weight: 600;
        color: #ffffff;
        cursor: pointer;
      }
      .btn-approve {
        background: #10693c;
      }
      .btn-reject {
        background: #9b1c1c;
      }
      button:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .ok {
        color: #10693c;
      }
      .error {
        color: #9b1c1c;
      }
    `
  ]
})
export class FixerReviewComponent {
  private readonly api = inject(FixerVerificationControllerService);

  private readonly fixerState = signal('');
  private readonly motivoState = signal('');
  private readonly procesandoState = signal(false);
  private readonly exitoState = signal<string | null>(null);
  private readonly errorState = signal<string | null>(null);

  private readonly reviewState = signal<ReviewResponse | null>(null);
  private readonly loadingReviewState = signal(false);
  private readonly reviewErrorState = signal<string | null>(null);

  readonly procesando = this.procesandoState.asReadonly();
  readonly exito = this.exitoState.asReadonly();
  readonly error = this.errorState.asReadonly();

  readonly review = this.reviewState.asReadonly();
  readonly loadingReview = this.loadingReviewState.asReadonly();
  readonly reviewError = this.reviewErrorState.asReadonly();

  /**
   * Solo hay algo que decidir cuando la revisión cargada corresponde a un perfil que
   * efectivamente está esperando una decisión (backend: `FixerProfile.requireUnderReview()`).
   * Cargar la revisión de un Fixer ya verificado o nunca enviado, por ejemplo, no debe habilitar
   * los botones aunque el `GET` haya funcionado.
   */
  private readonly canDecide = computed(
    () => this.reviewState()?.underReview === true && !this.procesandoState()
  );

  get fixerUserId(): string {
    return this.fixerState();
  }

  set fixerUserId(valor: string) {
    this.fixerState.set(valor);
    // Cambiar el identificador invalida cualquier revisión ya cargada: nunca se debe decidir
    // sobre el perfil que se veía en pantalla si el admin ya escribió un id distinto y todavía
    // no volvió a cargar la revisión de ese nuevo id.
    this.reviewState.set(null);
    this.reviewErrorState.set(null);
    this.exitoState.set(null);
    this.errorState.set(null);
  }

  get motivo(): string {
    return this.motivoState();
  }

  set motivo(valor: string) {
    this.motivoState.set(valor);
  }

  puedeBuscar(): boolean {
    return this.fixerState().trim().length > 0 && !this.loadingReviewState();
  }

  /**
   * FR-UC-23: trae identidad, especialidades y documentos (con URLs firmadas de lectura) del
   * Fixer indicado, para que el administrador decida con la evidencia delante en vez de a
   * ciegas. Es el paso que la pantalla anterior no tenía.
   */
  cargarRevision(): void {
    if (!this.puedeBuscar()) {
      return;
    }
    this.loadingReviewState.set(true);
    this.reviewErrorState.set(null);
    this.reviewState.set(null);

    this.api.reviewOf(this.fixerState().trim()).subscribe({
      next: (review) => {
        this.reviewState.set(review);
        this.loadingReviewState.set(false);
      },
      error: (failure: HttpErrorResponse) => {
        this.reviewErrorState.set(this.describe(failure));
        this.loadingReviewState.set(false);
      }
    });
  }

  specialtiesOf(review: ReviewResponse): Specialty[] {
    return Array.from(review.specialties ?? []);
  }

  documentLabel(type: FixerVerificationDocumentType): string {
    return DOCUMENT_LABELS[type] ?? type;
  }

  specialtyLabel(esp: Specialty): string {
    return SPECIALTY_LABELS[esp] ?? esp;
  }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  puedeDecidir(): boolean {
    return this.canDecide();
  }

  puedeRechazar(): boolean {
    return this.puedeDecidir() && this.motivoState().trim().length > 0;
  }

  aprobar(): void {
    if (!this.puedeDecidir()) {
      return;
    }
    this.enviar(this.api.approve(this.fixerState().trim()), 'El técnico quedó verificado.');
  }

  rechazar(): void {
    if (!this.puedeRechazar()) {
      return;
    }
    this.enviar(
      this.api.reject1(this.fixerState().trim(), { reason: this.motivoState().trim() }),
      'La verificación quedó rechazada y el técnico puede volver a enviarla.'
    );
  }

  private enviar(peticion: { subscribe: (observer: Record<string, unknown>) => unknown }, ok: string): void {
    this.procesandoState.set(true);
    this.exitoState.set(null);
    this.errorState.set(null);
    peticion.subscribe({
      next: () => {
        this.procesandoState.set(false);
        this.exitoState.set(ok);
        this.motivoState.set('');
        // Refrescar la revisión: tras decidir, `underReview` pasa a false en el backend y esta
        // pantalla no debe dejar la posibilidad de decidir dos veces sobre el mismo perfil.
        this.cargarRevision();
      },
      error: (failure: HttpErrorResponse) => {
        this.procesandoState.set(false);
        this.errorState.set(this.describe(failure));
      }
    });
  }

  // Traduce los códigos de conflicto del backend a un mensaje accionable
  private describe(failure: HttpErrorResponse): string {
    switch (failure.error?.code) {
      case 'NOT_UNDER_REVIEW':
        return 'Ese técnico no tiene una entrega esperando decisión.';
      case 'SELF_REVIEW':
        return 'Un administrador no puede decidir su propia verificación.';
      case 'PROFILE_NOT_FOUND':
        return 'No existe un perfil de técnico con ese identificador.';
      case 'ALREADY_VERIFIED':
        return 'Ese perfil ya está verificado.';
      case 'PROFILE_SUSPENDED':
        return 'Ese perfil está suspendido.';
      case 'ACCESS_DENIED':
        return 'Tu cuenta no tiene privilegios de administrador vigentes.';
      case 'INVALID_REQUEST':
        return 'Revisa el identificador y el motivo enviados.';
    }
    if (failure.status === 404) {
      return 'No existe un perfil de técnico con ese identificador.';
    }
    return failure.error?.message || 'No se pudo completar la operación. Inténtalo de nuevo.';
  }
}
