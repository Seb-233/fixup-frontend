import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { OwnPortfolioResponse, PieceResponse } from '../../../../api/generated';
import { PortfolioService } from './portfolio.service';

export type UploadStep = 'IDLE' | 'VALIDATING' | 'TICKET' | 'UPLOADING' | 'CONFIRMING' | 'CREATING';

// FR-UC-17: alta segura de piezas mediante mediaId y galería interactiva del portafolio
@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="portfolio">
      <header class="portfolio-header">
        <div>
          <h1 class="title">Mi portafolio</h1>
          <p class="subtitle">
            Publica tus trabajos realizados mediante carga directa y segura. Las piezas usan identificadores
            de medios controlados por el servidor.
          </p>
        </div>

        @if (portfolio(); as p) {
          <div class="portfolio-status-box">
            <span
              class="status-badge"
              [class.published]="p.status === 'PUBLISHED'"
              [class.draft]="p.status !== 'PUBLISHED'"
            >
              {{ p.status === 'PUBLISHED' ? 'PUBLICADO' : 'BORRADOR' }}
            </span>

            @if (p.status === 'PUBLISHED') {
              <button
                type="button"
                class="btn-secondary btn-sm"
                [disabled]="procesandoAccion()"
                (click)="despublicarPortafolio()"
              >
                Despublicar
              </button>
            } @else {
              <button
                type="button"
                class="btn-primary btn-sm"
                [disabled]="!puedePublicarPortafolio() || procesandoAccion()"
                (click)="publicarPortafolio()"
                title="Se requieren al menos 3 fotos visibles para publicar"
              >
                Publicar portafolio
              </button>
            }
          </div>
        }
      </header>

      @if (portfolio() && visiblePieces().length < 3) {
        <div class="alert-info" role="status">
          Para publicar tu portafolio debes contar con al menos <strong>3 fotografías visibles</strong>.
          Actualmente tienes {{ visiblePieces().length }} visible{{ visiblePieces().length === 1 ? '' : 's' }}.
        </div>
      }

      <!-- Formulario para agregar una pieza -->
      <form class="publish-form" (ngSubmit)="iniciarSubida()">
        <h2>Agregar nueva fotografía al portafolio</h2>

        <div class="form-row">
          <div class="field grow">
            <label for="titulo">Título de la fotografía *</label>
            <input
              id="titulo"
              name="titulo"
              type="text"
              maxlength="120"
              placeholder="Ej: Remodelación de baño principal"
              [(ngModel)]="titulo"
              required
            />
          </div>
        </div>

        <div class="field">
          <label for="descripcion">Descripción (opcional)</label>
          <textarea
            id="descripcion"
            name="descripcion"
            rows="2"
            maxlength="1000"
            placeholder="Detalles del trabajo realizado, materiales o acabados..."
            [(ngModel)]="descripcion"
          ></textarea>
        </div>

        <div class="field">
          <label for="archivo">Fotografía (JPEG, PNG o WebP, máx. 10 MB) *</label>
          <input
            id="archivo"
            name="archivo"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            (change)="onArchivoSeleccionado($event)"
          />
          @if (archivoSeleccionado(); as file) {
            <div class="file-preview">
              <span class="file-name">{{ file.name }} ({{ formatearTamano(file.size) }})</span>
            </div>
          }
        </div>

        <!-- Indicador de pasos de carga -->
        @if (subiendo()) {
          <div class="upload-progress-card">
            <div class="spinner"></div>
            <span>{{ mensajePaso() }}</span>
          </div>
        }

        <div class="form-actions">
          <button
            type="submit"
            class="btn-primary"
            [disabled]="!formularioValido() || subiendo()"
          >
            {{ subiendo() ? 'Procesando…' : 'Subir y agregar pieza' }}
          </button>

          @if (archivoFallido()) {
            <button
              type="button"
              class="btn-retry"
              [disabled]="subiendo()"
              (click)="reintentarSubida()"
            >
              Reintentar carga fallida
            </button>
          }
        </div>
      </form>

      @if (error(); as mensaje) {
        <div class="error-banner" role="alert">
          <span>{{ mensaje }}</span>
          @if (errorRecuperable()) {
            <small>Los datos que ingresaste se conservan en el formulario para reintentar.</small>
          }
        </div>
      }

      <!-- Galería de Piezas -->
      <div class="gallery-header">
        <h2 class="gallery-title">
          Fotografías en portafolio ({{ piezas().length }}/{{ maximoPiezas }})
        </h2>
        <span class="gallery-subtitle">
          Visibles: {{ visiblePieces().length }} | Ocultas: {{ piezas().length - visiblePieces().length }}
        </span>
      </div>

      @if (cargando()) {
        <p class="loading-text">Cargando tu portafolio…</p>
      } @else {
        <div class="gallery">
          @for (pieza of piezas(); track pieza.id) {
            <article class="piece-card" [class.hidden-piece]="pieza.visibility === 'HIDDEN'">
              <div class="image-wrapper">
                <img
                  [src]="pieza.readUrl"
                  [alt]="pieza.title"
                  loading="lazy"
                  (error)="onImageError($event)"
                />
                <span class="position-badge">#{{ pieza.position }}</span>
                <span class="visibility-tag" [class.public]="pieza.visibility === 'PUBLIC'">
                  {{ pieza.visibility === 'PUBLIC' ? 'Visible' : 'Oculta' }}
                </span>
              </div>

              <div class="piece-content">
                <h3 class="piece-title">{{ pieza.title }}</h3>
                @if (pieza.description) {
                  <p class="piece-desc">{{ pieza.description }}</p>
                }
                <div class="piece-meta">
                  <span class="media-id" title="Identificador de medio seguro">ID: {{ pieza.mediaId.slice(0, 8) }}…</span>
                </div>
              </div>

              <footer class="piece-actions">
                <button
                  type="button"
                  class="btn-action"
                  [disabled]="procesandoAccion()"
                  (click)="alternarVisibilidad(pieza)"
                >
                  {{ pieza.visibility === 'PUBLIC' ? 'Ocultar' : 'Mostrar' }}
                </button>
                <button
                  type="button"
                  class="btn-action danger"
                  [disabled]="procesandoAccion()"
                  (click)="eliminarPieza(pieza)"
                >
                  Eliminar
                </button>
              </footer>
            </article>
          } @empty {
            <div class="empty-gallery">
              <p>Aún no has agregado fotografías a tu portafolio.</p>
              <small>Sube tus mejores trabajos para que los clientes puedan cotizar con confianza.</small>
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 2rem 1rem;
      }
      .portfolio {
        max-width: 920px;
        margin: 0 auto;
      }
      .portfolio-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1.5rem;
        margin-bottom: 1.5rem;
      }
      .title {
        margin: 0 0 0.5rem;
        font-size: 1.75rem;
      }
      .subtitle {
        color: #5b6472;
        font-size: 0.9rem;
        margin: 0;
      }
      .portfolio-status-box {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.5rem;
        flex-shrink: 0;
      }
      .status-badge {
        display: inline-block;
        border-radius: 999px;
        padding: 0.35rem 0.85rem;
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.04em;
      }
      .status-badge.published {
        background: #e0f7e9;
        color: #10693c;
      }
      .status-badge.draft {
        background: #fff4d6;
        color: #8a6100;
      }
      .alert-info {
        background: #eff6ff;
        border-left: 4px solid #3b82f6;
        padding: 0.75rem 1rem;
        border-radius: 6px;
        margin-bottom: 1.5rem;
        font-size: 0.875rem;
        color: #1e3a8a;
      }
      .publish-form {
        display: flex;
        flex-direction: column;
        gap: 0.85rem;
        background: #ffffff;
        border-radius: 12px;
        box-shadow: var(--fixup-shadow-md);
        padding: 1.5rem;
        margin-bottom: 2rem;
      }
      .publish-form h2 {
        font-size: 1.15rem;
        margin: 0 0 0.5rem;
      }
      .form-row {
        display: flex;
        gap: 1rem;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .field.grow {
        flex: 1;
      }
      label {
        font-weight: 600;
        font-size: 0.85rem;
      }
      input[type='text'],
      textarea {
        padding: 0.65rem 0.75rem;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font: inherit;
      }
      input[type='file'] {
        font-size: 0.85rem;
        padding: 0.35rem 0;
      }
      .file-preview {
        font-size: 0.8rem;
        color: #4b5563;
        margin-top: 0.25rem;
      }
      .upload-progress-card {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 0.75rem 1rem;
        font-size: 0.85rem;
        color: #334155;
      }
      .spinner {
        width: 18px;
        height: 18px;
        border: 2px solid #cbd5e1;
        border-top-color: #3b82f6;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
      .form-actions {
        display: flex;
        gap: 0.75rem;
        margin-top: 0.5rem;
      }
      .btn-primary,
      .btn-secondary,
      .btn-retry {
        padding: 0.65rem 1.25rem;
        border: 0;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        font-size: 0.875rem;
      }
      .btn-sm {
        padding: 0.4rem 0.85rem;
        font-size: 0.8rem;
      }
      .btn-primary {
        background: var(--fixup-primary, #1d4ed8);
        color: #ffffff;
      }
      .btn-secondary {
        background: #4b5563;
        color: #ffffff;
      }
      .btn-retry {
        background: #d97706;
        color: #ffffff;
      }
      .btn-primary:disabled,
      .btn-secondary:disabled,
      .btn-retry:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .error-banner {
        background: #fde8e8;
        border-left: 4px solid #e02424;
        color: #9b1c1c;
        padding: 0.75rem 1rem;
        border-radius: 6px;
        margin-bottom: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.875rem;
      }
      .gallery-header {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 1rem;
      }
      .gallery-title {
        font-size: 1.25rem;
        margin: 0;
      }
      .gallery-subtitle {
        font-size: 0.85rem;
        color: #6b7280;
      }
      .gallery {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 1.25rem;
      }
      .piece-card {
        background: #ffffff;
        border-radius: 12px;
        box-shadow: var(--fixup-shadow-sm);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        border: 1px solid #e5e7eb;
        transition: opacity 0.2s ease;
      }
      .piece-card.hidden-piece {
        opacity: 0.65;
        border-style: dashed;
      }
      .image-wrapper {
        position: relative;
        height: 180px;
        background: #f1f5f9;
      }
      .image-wrapper img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .position-badge {
        position: absolute;
        top: 0.5rem;
        left: 0.5rem;
        background: rgba(15, 23, 42, 0.75);
        color: #ffffff;
        font-size: 0.75rem;
        padding: 0.2rem 0.5rem;
        border-radius: 6px;
        font-weight: 600;
      }
      .visibility-tag {
        position: absolute;
        top: 0.5rem;
        right: 0.5rem;
        padding: 0.2rem 0.55rem;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 700;
        background: #fee2e2;
        color: #991b1b;
      }
      .visibility-tag.public {
        background: #dcfce7;
        color: #166534;
      }
      .piece-content {
        padding: 1rem;
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
      }
      .piece-title {
        margin: 0;
        font-size: 1rem;
      }
      .piece-desc {
        margin: 0;
        font-size: 0.85rem;
        color: #4b5563;
        line-height: 1.4;
      }
      .piece-meta {
        margin-top: auto;
        padding-top: 0.5rem;
        font-size: 0.75rem;
        color: #94a3b8;
      }
      .piece-actions {
        display: flex;
        border-top: 1px solid #f1f5f9;
        background: #fafafa;
      }
      .btn-action {
        flex: 1;
        padding: 0.6rem 0.5rem;
        border: 0;
        background: transparent;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        color: #374151;
      }
      .btn-action:hover:not(:disabled) {
        background: #f3f4f6;
      }
      .btn-action.danger {
        color: #dc2626;
        border-left: 1px solid #f1f5f9;
      }
      .btn-action.danger:hover:not(:disabled) {
        background: #fef2f2;
      }
      .empty-gallery {
        grid-column: 1 / -1;
        text-align: center;
        padding: 3rem 1rem;
        background: #f8fafc;
        border-radius: 12px;
        border: 2px dashed #cbd5e1;
      }
      .empty-gallery p {
        margin: 0 0 0.5rem;
        font-size: 1rem;
        color: #334155;
        font-weight: 600;
      }
      .empty-gallery small {
        color: #64748b;
      }
    `
  ]
})
export class PortfolioComponent implements OnInit {
  private readonly portfolioService = inject(PortfolioService);

  readonly maximoPiezas = 20;

  readonly portfolio = signal<OwnPortfolioResponse | null>(null);
  readonly piezas = computed<PieceResponse[]>(() => this.portfolio()?.pieces ?? []);
  readonly visiblePieces = computed<PieceResponse[]>(() =>
    this.piezas().filter((p) => p.visibility === 'PUBLIC')
  );
  readonly puedePublicarPortafolio = computed(() => this.visiblePieces().length >= 3);

  readonly cargando = signal(false);
  readonly subiendo = signal(false);
  readonly procesandoAccion = signal(false);
  readonly pasoCarga = signal<UploadStep>('IDLE');
  readonly error = signal<string | null>(null);
  readonly errorRecuperable = signal(false);
  readonly archivoFallido = signal<{ file: File; titulo: string; descripcion?: string } | null>(null);

  // Campos del formulario
  titulo = '';
  descripcion = '';
  readonly archivoSeleccionado = signal<File | null>(null);

  ngOnInit(): void {
    this.cargarPortafolio();
  }

  cargarPortafolio(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.portfolioService.myPortfolio().subscribe({
      next: (resp) => {
        this.portfolio.set(resp);
        this.cargando.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.describirError(err));
        this.cargando.set(false);
      }
    });
  }

  onArchivoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const validacion = this.portfolioService.validateFile(file);
      if (!validacion.valid) {
        this.error.set(validacion.error ?? 'Archivo no válido.');
        this.archivoSeleccionado.set(null);
        input.value = '';
        return;
      }
      this.error.set(null);
      this.archivoSeleccionado.set(file);
    }
  }

  formularioValido(): boolean {
    return this.titulo.trim().length > 0 && this.archivoSeleccionado() !== null;
  }

  iniciarSubida(): void {
    if (!this.formularioValido()) return;
    const file = this.archivoSeleccionado();
    if (!file) return;

    this.ejecutarFlujoSubida(file, this.titulo.trim(), this.descripcion.trim());
  }

  reintentarSubida(): void {
    const fallido = this.archivoFallido();
    if (!fallido) return;
    this.ejecutarFlujoSubida(fallido.file, fallido.titulo, fallido.descripcion);
  }

  private ejecutarFlujoSubida(file: File, titulo: string, descripcion?: string): void {
    this.subiendo.set(true);
    this.error.set(null);
    this.errorRecuperable.set(false);
    this.pasoCarga.set('TICKET');

    // 1. Solicitar ticket de carga firmada
    this.portfolioService.requestUploadTicket(file).subscribe({
      next: (ticket) => {
        this.pasoCarga.set('UPLOADING');
        // 2. PUT binario directo al almacenamiento externo sin Authorization
        this.portfolioService.uploadBinary(ticket, file).subscribe({
          next: () => {
            this.pasoCarga.set('CONFIRMING');
            // 3. Confirmar la carga con mediaId
            this.portfolioService.confirmUpload(ticket.mediaId).subscribe({
              next: () => {
                this.pasoCarga.set('CREATING');
                // 4. Crear la pieza en el portafolio con mediaId
                this.portfolioService.addPiece(ticket.mediaId, titulo, descripcion).subscribe({
                  next: () => {
                    this.subiendo.set(false);
                    this.pasoCarga.set('IDLE');
                    this.archivoFallido.set(null);
                    this.limpiarFormulario();
                    this.cargarPortafolio();
                  },
                  error: (err: HttpErrorResponse) => this.manejarFalloSubida(err, file, titulo, descripcion)
                });
              },
              error: (err: HttpErrorResponse) => this.manejarFalloSubida(err, file, titulo, descripcion)
            });
          },
          error: (err: HttpErrorResponse) => this.manejarFalloSubida(err, file, titulo, descripcion)
        });
      },
      error: (err: HttpErrorResponse) => this.manejarFalloSubida(err, file, titulo, descripcion)
    });
  }

  private manejarFalloSubida(err: HttpErrorResponse, file: File, titulo: string, descripcion?: string): void {
    this.subiendo.set(false);
    this.pasoCarga.set('IDLE');
    this.error.set(this.describirError(err));
    this.errorRecuperable.set(true);
    this.archivoFallido.set({ file, titulo, descripcion });
    // NO se limpian this.titulo ni this.descripcion para permitir corregir o reintentar
  }

  alternarVisibilidad(pieza: PieceResponse): void {
    this.procesandoAccion.set(true);
    this.error.set(null);
    const accion$ =
      pieza.visibility === 'PUBLIC'
        ? this.portfolioService.hidePiece(pieza.id)
        : this.portfolioService.showPiece(pieza.id);

    accion$.subscribe({
      next: () => {
        this.procesandoAccion.set(false);
        this.cargarPortafolio();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.describirError(err));
        this.procesandoAccion.set(false);
      }
    });
  }

  eliminarPieza(pieza: PieceResponse): void {
    if (!confirm(`¿Eliminar la pieza "${pieza.title}"?`)) return;

    this.procesandoAccion.set(true);
    this.error.set(null);
    this.portfolioService.deletePiece(pieza.id).subscribe({
      next: () => {
        this.procesandoAccion.set(false);
        this.cargarPortafolio();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.describirError(err));
        this.procesandoAccion.set(false);
      }
    });
  }

  publicarPortafolio(): void {
    if (this.visiblePieces().length < 3) {
      this.error.set('Se requieren al menos 3 fotos visibles para publicar el portafolio.');
      return;
    }

    this.procesandoAccion.set(true);
    this.error.set(null);
    this.portfolioService.publishPortfolio().subscribe({
      next: () => {
        this.procesandoAccion.set(false);
        this.cargarPortafolio();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.describirError(err));
        this.procesandoAccion.set(false);
      }
    });
  }

  despublicarPortafolio(): void {
    this.procesandoAccion.set(true);
    this.error.set(null);
    this.portfolioService.unpublishPortfolio().subscribe({
      next: () => {
        this.procesandoAccion.set(false);
        this.cargarPortafolio();
      },
      error: (err: HttpErrorResponse) => {
        this.error.set(this.describirError(err));
        this.procesandoAccion.set(false);
      }
    });
  }

  mensajePaso(): string {
    switch (this.pasoCarga()) {
      case 'TICKET':
        return 'Solicitando ticket de carga…';
      case 'UPLOADING':
        return 'Subiendo archivo al almacenamiento directo…';
      case 'CONFIRMING':
        return 'Confirmando carga de medio…';
      case 'CREATING':
        return 'Registrando pieza en tu portafolio…';
      default:
        return 'Procesando…';
    }
  }

  formatearTamano(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'assets/images/placeholder.svg';
  }

  private limpiarFormulario(): void {
    this.titulo = '';
    this.descripcion = '';
    this.archivoSeleccionado.set(null);
  }

  private describirError(err: HttpErrorResponse): string {
    if (err.status === 401) {
      return 'Sesión expirada o no autenticada. Inicia sesión nuevamente.';
    }
    if (err.status === 403) {
      return 'Acceso denegado: debes ser un técnico verificado para gestionar tu portafolio.';
    }
    if (err.status === 404) {
      return 'Pieza o portafolio no encontrado.';
    }
    if (err.status === 409) {
      return err.error?.message || 'Conflicto de estado al modificar el portafolio.';
    }
    if (err.status === 400) {
      return err.error?.message || 'Los datos enviados son inválidos.';
    }
    return err.error?.message || 'Ocurrió un error inesperado al procesar la solicitud.';
  }
}
