import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { PieceRequest, PieceResponse, PortfolioControllerService } from '../../../../api/generated';

// FR-UC-17: alta de pieza y galería del portafolio del técnico
@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="portfolio">
      <h1 class="title">Mi portafolio</h1>
      <p class="subtitle">
        Solo un técnico verificado publica piezas. El archivo se sube al almacenamiento contra una
        URL firmada y aquí se registra únicamente su clave.
      </p>

      <form class="publish-form" (ngSubmit)="publicar()">
        <div class="row">
          <div class="field">
            <label for="tipo">Tipo</label>
            <select id="tipo" name="tipo" [(ngModel)]="tipo">
              <option value="PHOTO">Foto</option>
              <option value="VIDEO">Video</option>
            </select>
          </div>
          <div class="field grow">
            <label for="titulo">Título</label>
            <input id="titulo" name="titulo" type="text" maxlength="120" [(ngModel)]="titulo" />
          </div>
        </div>

        <label for="clave">Clave de almacenamiento</label>
        <input
          id="clave"
          name="clave"
          type="text"
          maxlength="512"
          placeholder="fixers/portafolio/cocina.jpg"
          [(ngModel)]="clave"
        />

        <label for="descripcion">Descripción</label>
        <textarea
          id="descripcion"
          name="descripcion"
          rows="2"
          maxlength="1000"
          [(ngModel)]="descripcion"
        ></textarea>

        <button type="submit" class="btn-primary" [disabled]="!puedePublicar() || publicando()">
          {{ publicando() ? 'Publicando…' : 'Publicar pieza' }}
        </button>
      </form>

      @if (error(); as mensaje) {
        <p class="error" role="alert">{{ mensaje }}</p>
      }

      <h2 class="gallery-title">Galería ({{ piezas().length }}/{{ maximoPiezas }})</h2>

      @if (cargando()) {
        <p class="loading-text">Cargando tu portafolio…</p>
      } @else {
        <div class="gallery">
          @for (pieza of piezas(); track pieza.id) {
            <article class="piece" [class.hidden-piece]="pieza.visibility === 'HIDDEN'">
              <header>
                <span class="kind">{{ pieza.kind === 'PHOTO' ? 'Foto' : 'Video' }}</span>
                <span class="position">#{{ pieza.position }}</span>
              </header>
              <h3>{{ pieza.title }}</h3>
              @if (pieza.description) {
                <p class="description">{{ pieza.description }}</p>
              }
              <p class="storage-key" title="Clave de almacenamiento">{{ pieza.storageKey }}</p>
              <footer>
                <span class="visibility" [class.public]="pieza.visibility === 'PUBLIC'">
                  {{ pieza.visibility === 'PUBLIC' ? 'Visible' : 'Oculta' }}
                </span>
                <button type="button" (click)="alternarVisibilidad(pieza)">
                  {{ pieza.visibility === 'PUBLIC' ? 'Ocultar' : 'Mostrar' }}
                </button>
              </footer>
            </article>
          } @empty {
            <p class="empty">Aún no has publicado piezas.</p>
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
        max-width: 880px;
        margin: 0 auto;
      }
      .title {
        margin: 0 0 0.5rem;
        font-size: 1.5rem;
      }
      .subtitle {
        color: #5b6472;
        font-size: 0.875rem;
      }
      .publish-form {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        background: #ffffff;
        border-radius: 12px;
        box-shadow: var(--fixup-shadow-md);
        padding: 1.5rem;
        margin: 1.5rem 0;
      }
      .row {
        display: flex;
        gap: 0.75rem;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      .field.grow {
        flex: 1;
      }
      label {
        font-weight: 600;
        font-size: 0.875rem;
      }
      input,
      select,
      textarea {
        padding: 0.6rem 0.75rem;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font: inherit;
      }
      .btn-primary {
        margin-top: 0.5rem;
        padding: 0.7rem 1.25rem;
        border: 0;
        border-radius: 8px;
        background: var(--fixup-primary, #1d4ed8);
        color: #ffffff;
        font-weight: 600;
        cursor: pointer;
      }
      .btn-primary:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .gallery-title {
        font-size: 1.125rem;
      }
      .gallery {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      }
      .piece {
        background: #ffffff;
        border-radius: 12px;
        box-shadow: var(--fixup-shadow-md);
        padding: 1rem;
      }
      .piece.hidden-piece {
        opacity: 0.65;
      }
      .piece header {
        display: flex;
        justify-content: space-between;
        font-size: 0.75rem;
        color: #6b7280;
      }
      .piece h3 {
        margin: 0.5rem 0;
        font-size: 1rem;
      }
      .description {
        font-size: 0.875rem;
        color: #4b5563;
      }
      .storage-key {
        font-family: ui-monospace, monospace;
        font-size: 0.75rem;
        color: #6b7280;
        overflow-wrap: anywhere;
      }
      .piece footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-top: 0.75rem;
      }
      .visibility {
        border-radius: 999px;
        padding: 0.2rem 0.65rem;
        font-size: 0.75rem;
        font-weight: 600;
        background: #eceff3;
        color: #4b5563;
      }
      .visibility.public {
        background: #e0f7e9;
        color: #10693c;
      }
      .piece footer button {
        border: 1px solid #d1d5db;
        background: #ffffff;
        border-radius: 8px;
        padding: 0.35rem 0.75rem;
        cursor: pointer;
        font-size: 0.8125rem;
      }
      .empty {
        color: #6b7280;
      }
      .error {
        color: #9b1c1c;
      }
    `
  ]
})
export class PortfolioComponent implements OnInit {
  private readonly api = inject(PortfolioControllerService);

  readonly maximoPiezas = 20;

  private readonly piezasState = signal<PieceResponse[]>([]);
  private readonly cargandoState = signal(false);
  private readonly publicandoState = signal(false);
  private readonly errorState = signal<string | null>(null);

  private readonly tipoState = signal<PieceRequest['kind']>('PHOTO');
  private readonly tituloState = signal('');
  private readonly claveState = signal('');
  private readonly descripcionState = signal('');

  readonly piezas = computed(() => this.piezasState());
  readonly cargando = this.cargandoState.asReadonly();
  readonly publicando = this.publicandoState.asReadonly();
  readonly error = this.errorState.asReadonly();

  get tipo(): PieceRequest['kind'] {
    return this.tipoState();
  }

  set tipo(valor: PieceRequest['kind']) {
    this.tipoState.set(valor);
  }

  get titulo(): string {
    return this.tituloState();
  }

  set titulo(valor: string) {
    this.tituloState.set(valor);
  }

  get clave(): string {
    return this.claveState();
  }

  set clave(valor: string) {
    this.claveState.set(valor);
  }

  get descripcion(): string {
    return this.descripcionState();
  }

  set descripcion(valor: string) {
    this.descripcionState.set(valor);
  }

  ngOnInit(): void {
    this.cargar();
  }

  puedePublicar(): boolean {
    return this.tituloState().trim().length > 0 && this.claveState().trim().length > 0;
  }

  cargar(): void {
    this.cargandoState.set(true);
    this.errorState.set(null);
    this.api.myPortfolio().subscribe({
      next: (piezas) => {
        this.piezasState.set(piezas);
        this.cargandoState.set(false);
      },
      error: (failure: HttpErrorResponse) => {
        this.errorState.set(this.describe(failure));
        this.cargandoState.set(false);
      }
    });
  }

  publicar(): void {
    if (!this.puedePublicar()) {
      return;
    }
    this.publicandoState.set(true);
    this.errorState.set(null);
    const descripcion = this.descripcionState().trim();
    this.api
      .publish({
        kind: this.tipoState(),
        storageKey: this.claveState().trim(),
        title: this.tituloState().trim(),
        description: descripcion.length > 0 ? descripcion : undefined
      })
      .subscribe({
        next: (pieza) => {
          this.piezasState.update((piezas) => [...piezas, pieza]);
          this.publicandoState.set(false);
          this.tituloState.set('');
          this.claveState.set('');
          this.descripcionState.set('');
        },
        error: (failure: HttpErrorResponse) => {
          this.errorState.set(this.describe(failure));
          this.publicandoState.set(false);
        }
      });
  }

  alternarVisibilidad(pieza: PieceResponse): void {
    const peticion =
      pieza.visibility === 'PUBLIC' ? this.api.hide(pieza.id) : this.api.show(pieza.id);
    this.errorState.set(null);
    peticion.subscribe({
      next: (actualizada) => {
        this.piezasState.update((piezas) =>
          piezas.map((actual) => (actual.id === actualizada.id ? actualizada : actual))
        );
      },
      error: (failure: HttpErrorResponse) => this.errorState.set(this.describe(failure))
    });
  }

  // Traduce los códigos del backend sin exponer detalles internos al usuario
  private describe(failure: HttpErrorResponse): string {
    switch (failure.error?.code) {
      case 'PORTFOLIO_FULL':
        return `Tu portafolio ya tiene el máximo de ${this.maximoPiezas} piezas.`;
      case 'PIECE_NOT_FOUND':
        return 'Esa pieza no existe en tu portafolio.';
      case 'VISIBILITY_UNCHANGED':
        return 'La pieza ya estaba en ese estado.';
      case 'ACCESS_DENIED':
        return 'Necesitas ser un técnico verificado para gestionar tu portafolio.';
      case 'INVALID_REQUEST':
        return 'Revisa el título, la clave y la descripción.';
      default:
        return 'No se pudo completar la operación. Inténtalo de nuevo.';
    }
  }
}
