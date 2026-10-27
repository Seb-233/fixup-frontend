import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PeopleApi } from '../../data/people.api';
import { CITIES, SPECIALTY, SPECIALTIES, initials } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { LabelPipe } from '../../shared/ui/pipes';
import { StarsComponent } from '../../shared/ui/stars.component';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';

@Component({
  selector: 'app-directory-page',
  imports: [FormsModule, RouterLink, IconComponent, StarsComponent, LabelPipe, LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>Técnicos verificados</h1>
          <p class="lede">Técnicos que verificaron su identidad y su oficio en Fix&amp;Rent, con las calificaciones de sus trabajos terminados.</p>
        </div>
      </header>

      <form class="toolbar panel" (ngSubmit)="apply()">
        <div class="field">
          <label for="specialty">Especialidad</label>
          <select id="specialty" class="select" name="specialty" [(ngModel)]="specialtyFilter">
            <option value="">Todas</option>
            @for (s of specialties; track s) { <option [value]="s">{{ s | label: specialtyNames }}</option> }
          </select>
        </div>
        <div class="field">
          <label for="city">Ciudad</label>
          <input id="city" class="input" name="city" list="dir-cities" [(ngModel)]="cityFilter" placeholder="Todas" />
          <datalist id="dir-cities">@for (c of cities; track c) { <option [value]="c"></option> }</datalist>
        </div>
        <button type="submit" class="btn btn-primary"><app-icon name="search" />Buscar</button>
      </form>

      @if (fixers.isLoading() && !fixers.hasValue()) {
        <app-loading text="Buscando técnicos…" />
      } @else if (fixers.error()) {
        <app-error (retry)="fixers.reload()" />
      } @else if (fixers.hasValue() && fixers.value().length) {
        <p class="text-sm text-muted">{{ fixers.value().length }} técnicos</p>
        <ul class="fixers">
          @for (f of fixers.value(); track f.fixerUserId) {
            <li>
              <a [routerLink]="['/fixers', f.fixerUserId]" class="fixer panel">
                <span class="avatar" aria-hidden="true">{{ initials(f.displayName) }}</span>
                <span class="stack-sm grow">
                  <span class="row-title">{{ f.displayName }}</span>
                  <span class="row-meta">{{ f.city || 'Ciudad sin indicar' }}{{ f.yearsExperience ? ' · ' + f.yearsExperience + ' años de experiencia' : '' }}</span>
                  <span class="cluster">
                    @for (s of f.specialties; track s) { <span class="chip">{{ s | label: specialtyNames }}</span> }
                  </span>
                </span>
                <app-stars [average]="f.ratingAverage" [count]="f.ratingCount" />
              </a>
            </li>
          }
        </ul>
      } @else {
        <app-empty title="No encontramos técnicos con esos filtros" text="Prueba con otra ciudad o con todas las especialidades." />
      }
    </div>
  `,
  styles: `
    .fixers { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-3); grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); }
    .fixer { display: flex; gap: var(--s-3); align-items: flex-start; color: inherit; text-decoration: none; height: 100%; }
    .fixer:hover { border-color: var(--border-control); }
    .grow { flex: 1; min-width: 0; }
  `
})
export class DirectoryPage {
  private readonly api = inject(PeopleApi);
  readonly specialties = SPECIALTIES;
  readonly specialtyNames = SPECIALTY;
  readonly cities = CITIES;
  readonly initials = initials;
  specialtyFilter = '';
  cityFilter = '';
  private readonly filters = signal({ specialty: '', city: '' });
  readonly fixers = rxResource({
    params: () => this.filters(),
    stream: ({ params }) => this.api.directory(params.specialty || undefined, params.city || undefined)
  });

  apply(): void {
    this.filters.set({ specialty: this.specialtyFilter, city: this.cityFilter.trim() });
  }
}
