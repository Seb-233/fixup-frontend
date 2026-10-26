import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import { catchError, of } from 'rxjs';
import { PeopleApi } from '../../data/people.api';
import { FixerReviews, PieceResponse } from '../../data/models';
import { WorkApi } from '../../data/work.api';
import { SPECIALTY, VERIFICATION_STATUS, initials } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { PhotoComponent } from '../../shared/ui/photo.component';
import { DayPipe, LabelPipe } from '../../shared/ui/pipes';
import { StarsComponent } from '../../shared/ui/stars.component';
import { ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { StatusComponent } from '../../shared/ui/status.component';

@Component({
  selector: 'app-fixer-profile-page',
  imports: [IconComponent, PhotoComponent, StarsComponent, StatusComponent, LabelPipe, DayPipe, LoadingComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <button type="button" class="back-link btn-reset" (click)="back()"><app-icon name="chevron-left" [size]="16" />Volver</button>
      @if (profile.isLoading() && !profile.hasValue()) {
        <app-loading text="Cargando perfil…" />
      } @else if (profile.error()) {
        <app-error title="No pudimos abrir este perfil" message="El técnico puede no estar activo en la plataforma." (retry)="profile.reload()" />
      } @else if (profile.hasValue()) {
        @let p = profile.value();
        <header class="profile-head">
          <span class="avatar big" aria-hidden="true">{{ initials(p.displayName) }}</span>
          <div class="stack-sm">
            <h1>{{ p.displayName }}</h1>
            <p class="lede">{{ p.city || 'Ciudad sin indicar' }}{{ p.yearsExperience ? ' · ' + p.yearsExperience + ' años de experiencia' : '' }}</p>
            <div class="cluster">
              <app-status [map]="verification" [value]="p.verificationStatus" />
              @for (s of p.specialties; track s) { <span class="chip">{{ s | label: specialty }}</span> }
            </div>
          </div>
        </header>

        <div class="split">
          <div class="stack">
            @if (p.bio) {
              <section class="stack-sm">
                <h2>Presentación</h2>
                <p class="bio">{{ p.bio }}</p>
              </section>
            }

            <section class="stack-sm" aria-labelledby="portfolio-title">
              <h2 id="portfolio-title">Trabajos destacados</h2>
              @if (portfolio.hasValue() && portfolio.value().length) {
                <ul class="pieces">
                  @for (piece of portfolio.value(); track piece.id) {
                    <li>
                      <figure>
                        <app-photo [src]="piece.readUrl" [alt]="piece.title" />
                        <figcaption>
                          <strong class="text-sm">{{ piece.title }}</strong>
                          @if (piece.description) { <span class="text-xs text-muted">{{ piece.description }}</span> }
                        </figcaption>
                      </figure>
                    </li>
                  }
                </ul>
              } @else if (portfolio.hasValue()) {
                <p class="text-muted">Este técnico aún no publica su portafolio.</p>
              }
            </section>

            <section class="stack-sm" aria-labelledby="reviews-title">
              <h2 id="reviews-title">Reseñas</h2>
              @if (reviews.hasValue() && reviews.value(); as r) {
                @if (r.reviews.length) {
                  <ul class="list">
                    @for (review of r.reviews; track review.id) {
                      <li class="review">
                        <div class="spread">
                          <span class="stars"><app-icon name="star" [size]="16" />{{ review.score }}</span>
                          <span class="text-xs text-muted">{{ review.raterName || 'Cliente' }} · {{ review.createdAt | day }}</span>
                        </div>
                        @if (review.comment) { <p class="text-sm">{{ review.comment }}</p> }
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="text-muted">Aún no tiene reseñas.</p>
                }
              }
            </section>
          </div>

          <aside class="sticky-aside">
            <div class="panel stack-sm">
              <h2 class="text-lg">Calificación</h2>
              <app-stars [average]="p.ratingAverage" [count]="p.ratingCount" />
              @if (distribution().length) {
                <ul class="dist">
                  @for (row of distribution(); track row.stars) {
                    <li>
                      <span class="text-sm">{{ row.stars }}</span>
                      <span class="track"><span class="fill" [style.width.%]="row.width"></span></span>
                      <span class="text-xs text-muted">{{ row.count }}</span>
                    </li>
                  }
                </ul>
              }
            </div>
          </aside>
        </div>
      }
    </div>
  `,
  styles: `
    .btn-reset { border: 0; background: none; padding: 0; cursor: pointer; }
    .profile-head { display: flex; gap: var(--s-4); align-items: center; flex-wrap: wrap; }
    .avatar.big { width: 72px; height: 72px; font-size: var(--fs-xl); }
    .bio { white-space: pre-line; max-width: 70ch; }
    .pieces { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-3); grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); }
    figure { margin: 0; display: grid; gap: var(--s-1); }
    figcaption { display: grid; gap: 2px; }
    .review { display: grid; gap: var(--s-1); padding: var(--s-3) 0; }
    .dist { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-1); }
    .dist li { display: grid; grid-template-columns: 16px 1fr 32px; gap: var(--s-2); align-items: center; }
    .track { height: 8px; border-radius: 4px; background: var(--surface-2); overflow: hidden; }
    .fill { display: block; height: 100%; background: var(--accent-text); }
  `
})
export class FixerProfilePage {
  private readonly people = inject(PeopleApi);
  private readonly work = inject(WorkApi);
  private readonly location = inject(Location);
  readonly fixerUserId = input.required<string>();
  readonly specialty = SPECIALTY;
  readonly verification = VERIFICATION_STATUS;
  readonly initials = initials;

  readonly profile = rxResource({ params: () => this.fixerUserId(), stream: ({ params }) => this.people.profile(params) });
  readonly portfolio = rxResource({
    params: () => this.fixerUserId(),
    stream: ({ params }) => this.people.portfolioOf(params).pipe(catchError(() => of<PieceResponse[]>([])))
  });
  readonly reviews = rxResource({
    params: () => this.fixerUserId(),
    stream: ({ params }) => this.work.fixerReviews(params).pipe(catchError(() => of<FixerReviews | null>(null)))
  });

  readonly distribution = computed(() => {
    if (!this.reviews.hasValue() || !this.reviews.value()) return [];
    const counts = this.reviews.value()!.distribution;
    const max = Math.max(1, ...counts);
    return [5, 4, 3, 2, 1].map((stars) => ({ stars, count: counts[stars - 1] ?? 0, width: Math.round(((counts[stars - 1] ?? 0) / max) * 100) }));
  });

  back(): void {
    this.location.back();
  }
}
