import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { MediaService } from '../../data/media.service';
import { PieceResponse } from '../../data/models';
import { PeopleApi } from '../../data/people.api';
import { errorMessage } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { PhotoPickerComponent } from '../../shared/ui/photo-picker.component';
import { PhotoComponent } from '../../shared/ui/photo.component';
import { DayPipe } from '../../shared/ui/pipes';
import { ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';

const MIN_TO_PUBLISH = 3;
const MAX_PIECES = 20;

@Component({
  selector: 'app-portfolio-page',
  imports: [FormsModule, RouterLink, IconComponent, PhotoPickerComponent, PhotoComponent, DayPipe, LoadingComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>Mi portafolio</h1>
          <p class="lede">Fotos de trabajos que hiciste. Se muestran en tu perfil público cuando lo publicas con al menos {{ minToPublish }} piezas visibles.</p>
        </div>
        <div class="actions">
          <a [routerLink]="['/fixers', me()]" class="btn btn-ghost"><app-icon name="eye" />Ver mi perfil público</a>
        </div>
      </header>

      @if (portfolio.isLoading() && !portfolio.hasValue()) {
        <app-loading text="Cargando portafolio…" />
      } @else if (portfolio.error()) {
        <app-error (retry)="portfolio.reload()" />
      } @else if (portfolio.hasValue()) {
        @let p = portfolio.value();
        <section class="panel publish">
          <div class="stack-sm">
            <strong>{{ p.status === 'PUBLISHED' ? 'Publicado' : 'Sin publicar' }}</strong>
            <span class="text-sm text-muted">
              @if (p.status === 'PUBLISHED') { Visible en tu perfil desde el {{ p.publishedAt | day }}. }
              @else { {{ visibleCount() }} de {{ minToPublish }} piezas visibles necesarias para publicar. }
            </span>
          </div>
          <button type="button" class="btn" [class.btn-primary]="p.status !== 'PUBLISHED'" [class.btn-secondary]="p.status === 'PUBLISHED'"
                  (click)="togglePublished(p.status !== 'PUBLISHED')" [disabled]="busy() || (p.status !== 'PUBLISHED' && visibleCount() < minToPublish)">
            {{ p.status === 'PUBLISHED' ? 'Retirar del perfil' : 'Publicar portafolio' }}
          </button>
        </section>

        @if (message()) { <div class="alert" [class.alert-danger]="messageIsError()" [class.alert-success]="!messageIsError()" role="status">{{ message() }}</div> }

        <div class="split">
          <section class="stack" aria-labelledby="pieces-title">
            <h2 id="pieces-title">Piezas ({{ p.pieces.length }} de {{ maxPieces }})</h2>
            @if (p.pieces.length) {
              <ul class="pieces">
                @for (piece of sortedPieces(); track piece.id) {
                  <li class="panel piece" [class.hidden-piece]="piece.visibility === 'HIDDEN'">
                    <app-photo [src]="piece.readUrl" [alt]="piece.title" />
                    <div class="stack-sm">
                      <strong>{{ piece.title }}</strong>
                      @if (piece.description) { <span class="text-sm text-muted">{{ piece.description }}</span> }
                      @if (piece.visibility === 'HIDDEN') { <span class="chip">Oculta</span> }
                    </div>
                    <div class="cluster">
                      <button type="button" class="btn btn-ghost" (click)="setVisible(piece, piece.visibility === 'HIDDEN')" [disabled]="busy()">
                        <app-icon [name]="piece.visibility === 'HIDDEN' ? 'eye' : 'eye-off'" />{{ piece.visibility === 'HIDDEN' ? 'Mostrar' : 'Ocultar' }}
                      </button>
                      <button type="button" class="btn btn-ghost" (click)="remove(piece)" [disabled]="busy()"><app-icon name="trash" />Eliminar</button>
                    </div>
                  </li>
                }
              </ul>
            } @else {
              <p class="text-muted">Aún no tienes piezas. Sube la primera con el formulario.</p>
            }
          </section>

          <aside class="sticky-aside">
            <form class="panel stack" (ngSubmit)="addPiece()">
              <h2 class="text-lg">Agregar pieza</h2>
              <app-photo-picker [max]="1" label="Elegir foto" (changed)="file.set($event[0] ?? null)" />
              <div class="field">
                <label for="title">Título *</label>
                <input id="title" class="input" name="title" maxlength="120" required [(ngModel)]="title" placeholder="Cambio de grifería en cocina" />
              </div>
              <div class="field">
                <label for="description">Descripción</label>
                <textarea id="description" class="textarea" rows="3" name="description" maxlength="1000" [(ngModel)]="description"></textarea>
              </div>
              @if (progress() !== null) {
                <div class="stack-sm upload-progress">
                  <progress max="100" [value]="progress()" aria-label="Progreso de la subida de la foto"></progress>
                  <span class="text-xs text-muted" aria-live="polite">Subiendo foto: {{ progress() }} %</span>
                </div>
              }
              <button type="submit" class="btn btn-primary" [disabled]="busy() || !file() || !title.trim() || p.pieces.length >= maxPieces">
                {{ busy() ? step() : 'Agregar al portafolio' }}
              </button>
            </form>
          </aside>
        </div>
      }
    </div>
  `,
  styles: `
    .publish { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: var(--s-3); }
    .pieces { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-3); grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr)); }
    .piece { display: grid; gap: var(--s-3); align-content: start; padding: var(--s-3); }
    .hidden-piece app-photo { opacity: 0.55; }
    .upload-progress progress { width: 100%; height: 8px; accent-color: var(--primary); }
  `
})
export class PortfolioPage {
  private readonly api = inject(PeopleApi);
  private readonly media = inject(MediaService);
  private readonly user = inject(CurrentUserStore);
  private readonly picker = viewChild(PhotoPickerComponent);

  readonly me = computed(() => this.user.user()?.id ?? '');
  readonly minToPublish = MIN_TO_PUBLISH;
  readonly maxPieces = MAX_PIECES;
  readonly portfolio = rxResource({ stream: () => this.api.myPortfolio() });
  readonly sortedPieces = computed(() => (this.portfolio.hasValue() ? [...this.portfolio.value().pieces].sort((a, b) => a.position - b.position) : []));
  readonly visibleCount = computed(() => this.sortedPieces().filter((p) => p.visibility === 'PUBLIC').length);

  readonly file = signal<File | null>(null);
  title = '';
  description = '';
  readonly busy = signal(false);
  readonly step = signal('');
  /** Porcentaje del binario ya enviado al almacenamiento; null cuando no hay subida en curso. */
  readonly progress = signal<number | null>(null);
  readonly message = signal<string | null>(null);
  readonly messageIsError = signal(false);

  addPiece(): void {
    const file = this.file();
    if (!file || !this.title.trim()) return;
    this.busy.set(true);
    this.step.set('Subiendo foto…');
    this.message.set(null);
    this.progress.set(0);
    let uploaded = false;
    this.media
      .upload(file, 'FIXER_PORTFOLIO', (percent) => this.progress.set(percent))
      .pipe(
        switchMap((mediaId) => {
          uploaded = true;
          this.progress.set(null);
          this.step.set('Guardando pieza…');
          return this.api.addPiece(mediaId, this.title.trim(), this.description.trim() || undefined);
        })
      )
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.progress.set(null);
          this.title = '';
          this.description = '';
          this.file.set(null);
          this.picker()?.clear();
          this.ok('Pieza agregada.');
          this.portfolio.reload();
        },
        error: (failure) => {
          this.progress.set(null);
          this.fail(failure, uploaded ? 'No pudimos agregar la pieza.' : 'La foto no se pudo subir. Revisa tu conexión e inténtalo de nuevo.');
        }
      });
  }

  setVisible(piece: PieceResponse, visible: boolean): void {
    this.busy.set(true);
    this.api.setPieceVisible(piece.id, visible).subscribe({
      next: () => {
        this.busy.set(false);
        this.portfolio.reload();
      },
      error: (failure) => this.fail(failure, 'No pudimos cambiar la visibilidad.')
    });
  }

  remove(piece: PieceResponse): void {
    if (typeof window !== 'undefined' && !window.confirm(`¿Eliminar "${piece.title}" del portafolio?`)) return;
    this.busy.set(true);
    this.api.removePiece(piece.id).subscribe({
      next: () => {
        this.busy.set(false);
        this.ok('Pieza eliminada.');
        this.portfolio.reload();
      },
      error: (failure) => this.fail(failure, 'No pudimos eliminar la pieza.')
    });
  }

  togglePublished(publish: boolean): void {
    this.busy.set(true);
    this.api.setPortfolioPublished(publish).subscribe({
      next: () => {
        this.busy.set(false);
        this.ok(publish ? 'Tu portafolio ya se ve en tu perfil público.' : 'Retiraste el portafolio de tu perfil.');
        this.portfolio.reload();
      },
      error: (failure) => this.fail(failure, 'No pudimos cambiar la publicación.')
    });
  }

  private ok(text: string): void {
    this.messageIsError.set(false);
    this.message.set(text);
  }

  private fail(failure: unknown, fallback: string): void {
    this.busy.set(false);
    this.messageIsError.set(true);
    this.message.set(errorMessage(failure, fallback));
  }
}
