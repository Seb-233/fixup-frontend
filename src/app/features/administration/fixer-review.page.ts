import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { PeopleApi } from '../../data/people.api';
import { DOCUMENT_TYPE, SPECIALTY, VERIFICATION_STATUS, errorMessage } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { PhotoComponent } from '../../shared/ui/photo.component';
import { AgoPipe, DayPipe, LabelPipe } from '../../shared/ui/pipes';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { StatusComponent } from '../../shared/ui/status.component';

@Component({
  selector: 'app-fixer-review-page',
  imports: [FormsModule, IconComponent, PhotoComponent, StatusComponent, LabelPipe, DayPipe, AgoPipe, LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>Verificación de técnicos</h1>
          <p class="lede">Técnicos que completaron sus documentos y esperan revisión, del más antiguo al más reciente.</p>
        </div>
      </header>

      @if (pending.isLoading() && !pending.hasValue()) {
        <app-loading text="Cargando la cola…" />
      } @else if (pending.error()) {
        <app-error (retry)="pending.reload()" />
      } @else if (pending.hasValue() && pending.value().length) {
        <div class="split">
          <ul class="list panel queue">
            @for (f of pending.value(); track f.fixerUserId) {
              <li>
                <button type="button" class="row-link queue-item" [class.current]="selected() === f.fixerUserId" (click)="select(f.fixerUserId)">
                  <span class="stack-sm grow">
                    <span class="row-title">{{ f.displayName }}</span>
                    <span class="row-meta">{{ specialtiesText(f.specialties) }}</span>
                    <span class="row-meta">Envió documentos {{ f.submittedAt | ago }}</span>
                  </span>
                  <app-icon name="chevron-right" />
                </button>
              </li>
            }
          </ul>

          <section class="sticky-aside" aria-live="polite">
            @if (!selected()) {
              <div class="panel panel-quiet"><p class="text-sm">Elige un técnico de la lista para revisar sus documentos.</p></div>
            } @else if (review.isLoading()) {
              <app-loading text="Abriendo documentos…" />
            } @else if (review.error()) {
              <app-error (retry)="review.reload()" />
            } @else if (review.hasValue()) {
              @let r = review.value();
              <div class="panel stack">
                <div class="spread">
                  <h2 class="text-lg">Documentos</h2>
                  <app-status [map]="status" [value]="r.status" />
                </div>
                <p class="text-sm text-muted">Especialidades: {{ specialtiesText(r.specialties) }} · enviado el {{ r.submittedAt | day }}</p>
                <ul class="docs">
                  @for (d of r.documents; track d.mediaId) {
                    <li>
                      <a [href]="d.readUrl" target="_blank" rel="noopener" class="doc">
                        <app-photo [src]="d.readUrl" [alt]="(d.type | label: documentType)" ratio="3 / 2" />
                        <span class="text-sm">{{ d.type | label: documentType }} <app-icon name="external" [size]="14" /></span>
                      </a>
                    </li>
                  }
                </ul>
                @if (message()) { <div class="alert" [class.alert-danger]="messageIsError()" [class.alert-success]="!messageIsError()" role="status">{{ message() }}</div> }
                @if (r.underReview) {
                  <div class="field">
                    <label for="reason">Motivo del rechazo</label>
                    <input id="reason" class="input" name="reason" maxlength="500" [(ngModel)]="reason" placeholder="La foto de la cédula está borrosa." />
                  </div>
                  <div class="cluster">
                    <button type="button" class="btn btn-primary" (click)="approve()" [disabled]="busy()"><app-icon name="check" />Aprobar</button>
                    <button type="button" class="btn btn-danger" (click)="reject()" [disabled]="busy() || !reason.trim()">Rechazar</button>
                  </div>
                }
              </div>
            }
          </section>
        </div>
      } @else {
        <app-empty title="No hay técnicos esperando revisión" text="Cuando un técnico complete su cédula y su certificado de oficio aparecerá aquí." />
      }
    </div>
  `,
  styles: `
    .queue { padding: 0 var(--s-4); align-self: start; }
    .queue-item { width: 100%; border: 0; background: none; text-align: left; cursor: pointer; }
    .queue-item.current .row-title { text-decoration: underline; text-underline-offset: 3px; }
    .grow { flex: 1; min-width: 0; }
    .docs { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-3); grid-template-columns: repeat(auto-fill, minmax(min(100%, 180px), 1fr)); }
    .doc { display: grid; gap: var(--s-1); color: inherit; text-decoration: none; }
  `
})
export class FixerReviewPage {
  private readonly api = inject(PeopleApi);
  readonly pending = rxResource({ stream: () => this.api.pendingVerifications() });
  readonly selected = signal<string | null>(null);
  readonly review = rxResource({ params: () => this.selected() ?? undefined, stream: ({ params }) => this.api.review(params) });
  readonly status = VERIFICATION_STATUS;
  readonly documentType = DOCUMENT_TYPE;
  reason = '';
  readonly busy = signal(false);
  readonly message = signal<string | null>(null);
  readonly messageIsError = signal(false);

  specialtiesText(list: Iterable<string>): string {
    return Array.from(list, (s) => SPECIALTY[s] ?? s).join(', ') || 'Sin especialidades';
  }

  select(fixerUserId: string): void {
    this.reason = '';
    this.message.set(null);
    this.selected.set(fixerUserId);
  }

  approve(): void {
    this.decide(this.api.approve(this.selected()!), 'Técnico aprobado. Ya puede cotizar.');
  }

  reject(): void {
    this.decide(this.api.reject(this.selected()!, this.reason.trim()), 'Rechazo registrado. El técnico verá el motivo.');
  }

  private decide(call: ReturnType<PeopleApi['approve']>, success: string): void {
    this.busy.set(true);
    call.subscribe({
      next: () => {
        this.busy.set(false);
        this.messageIsError.set(false);
        this.message.set(success);
        this.review.reload();
        this.pending.reload();
      },
      error: (failure) => {
        this.busy.set(false);
        this.messageIsError.set(true);
        this.message.set(errorMessage(failure, 'No pudimos registrar la decisión.'));
      }
    });
  }
}
