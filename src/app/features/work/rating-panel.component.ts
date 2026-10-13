import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { RatingResponse } from '../../data/models';
import { WorkApi } from '../../data/work.api';
import { errorMessage } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { DayPipe } from '../../shared/ui/pipes';

@Component({
  selector: 'app-rating-panel',
  imports: [FormsModule, IconComponent, DayPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel stack" aria-labelledby="rating-title">
      <h2 id="rating-title" class="text-lg">Calificación del trabajo</h2>
      @if (rating.hasValue() && rating.value(); as r) {
        <div class="stack-sm">
          <p class="stars big"><app-icon name="star" [size]="20" />{{ r.score }} de 5</p>
          <p class="text-sm text-muted">
            @if (r.punctuality) { Puntualidad {{ r.punctuality }} · }
            @if (r.quality) { Calidad {{ r.quality }} · }
            @if (r.cleanliness) { Orden y aseo {{ r.cleanliness }} · }
            {{ r.createdAt | day }}{{ r.raterName ? ' · ' + r.raterName : '' }}
          </p>
          @if (r.comment) { <blockquote>{{ r.comment }}</blockquote> }
        </div>
      } @else if (rating.hasValue() && canRate()) {
        <form class="stack" (ngSubmit)="submit()">
          <p class="text-sm text-muted">Tu calificación queda en el perfil público de {{ fixerName() || 'el técnico' }} y en el historial del inmueble.</p>
          @for (q of questions; track q.key) {
            <fieldset class="stack-sm">
              <legend class="text-base">{{ q.label }}{{ q.key === 'score' ? ' *' : '' }}</legend>
              <div class="segmented">
                @for (n of [1, 2, 3, 4, 5]; track n) {
                  <label><input type="radio" [name]="q.key" [attr.name]="q.key" [value]="n" [attr.value]="n" [(ngModel)]="answers[q.key]" />{{ n }}</label>
                }
              </div>
            </fieldset>
          }
          <div class="field">
            <label for="comment">Comentario</label>
            <textarea id="comment" class="textarea" rows="3" name="comment" maxlength="1000" [(ngModel)]="comment"
                      placeholder="Qué tal la atención, si llegó a tiempo, si dejó todo limpio…"></textarea>
          </div>
          @if (error()) { <div class="alert alert-danger" role="alert">{{ error() }}</div> }
          <div><button type="submit" class="btn btn-primary" [disabled]="busy() || !answers['score']">Enviar calificación</button></div>
        </form>
      } @else if (rating.hasValue()) {
        <p class="text-sm text-muted">El trabajo aún no tiene calificación.</p>
      }
    </section>
  `,
  styles: `
    .big { font-size: var(--fs-lg); }
    blockquote { margin: 0; padding-left: var(--s-3); border-left: 3px solid var(--border-control); }
  `
})
export class RatingPanelComponent {
  private readonly api = inject(WorkApi);

  readonly jobId = input.required<string>();
  readonly fixerName = input<string | null | undefined>();
  readonly canRate = input(false);

  readonly rating = rxResource({
    params: () => this.jobId(),
    // 204 sin cuerpo cuando aún no hay calificación: HttpClient entrega null.
    stream: ({ params }) => this.api.ratingForJob(params).pipe(map((r) => (r ?? null) as RatingResponse | null))
  });

  readonly questions = [
    { key: 'score', label: 'Calificación general' },
    { key: 'punctuality', label: 'Puntualidad' },
    { key: 'quality', label: 'Calidad del trabajo' },
    { key: 'cleanliness', label: 'Orden y aseo' }
  ];
  answers: Record<string, number | undefined> = {};
  comment = '';
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  submit(): void {
    if (!this.answers['score']) return;
    this.busy.set(true);
    this.error.set(null);
    this.api
      .rate({
        jobId: this.jobId(),
        score: Number(this.answers['score']),
        punctuality: this.answers['punctuality'] ? Number(this.answers['punctuality']) : undefined,
        quality: this.answers['quality'] ? Number(this.answers['quality']) : undefined,
        cleanliness: this.answers['cleanliness'] ? Number(this.answers['cleanliness']) : undefined,
        comment: this.comment.trim() || undefined
      })
      .subscribe({
        next: (rating) => {
          this.busy.set(false);
          this.rating.set(rating);
        },
        error: (failure) => {
          this.busy.set(false);
          this.error.set(errorMessage(failure, 'No pudimos guardar tu calificación.'));
        }
      });
  }
}
