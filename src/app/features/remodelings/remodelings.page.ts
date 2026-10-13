import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ProjectsApi } from '../../data/projects.api';
import { REMODELING_STATUS } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { DayPipe, MoneyPipe } from '../../shared/ui/pipes';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { StatusComponent } from '../../shared/ui/status.component';

@Component({
  selector: 'app-remodelings-page',
  imports: [RouterLink, IconComponent, StatusComponent, DayPipe, MoneyPipe, LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>Remodelaciones</h1>
          <p class="lede">Obras con varios oficios en un mismo inmueble. Cada requerimiento recibe sus propias cotizaciones y avanza por separado.</p>
        </div>
        <div class="actions"><a routerLink="/remodelings/new" class="btn btn-primary"><app-icon name="plus" />Nueva remodelación</a></div>
      </header>

      @if (projects.isLoading() && !projects.hasValue()) {
        <app-loading text="Cargando remodelaciones…" />
      } @else if (projects.error()) {
        <app-error (retry)="projects.reload()" />
      } @else if (projects.hasValue() && projects.value().length) {
        <ul class="projects">
          @for (p of projects.value(); track p.id) {
            <li>
              <a [routerLink]="['/remodelings', p.id]" class="panel project">
                <div class="spread">
                  <span class="row-title">{{ p.title }}</span>
                  <app-status [map]="status" [value]="p.progressStatus" />
                </div>
                <div class="meter" role="img" [attr.aria-label]="p.completedCount + ' de ' + p.requirementCount + ' requerimientos terminados'">
                  <span class="done" [style.width.%]="p.requirementCount ? (p.completedCount / p.requirementCount) * 100 : 0"></span>
                  <span class="assigned" [style.width.%]="p.requirementCount ? ((p.assignedCount - p.completedCount) / p.requirementCount) * 100 : 0"></span>
                </div>
                <span class="row-meta">
                  {{ p.completedCount }} de {{ p.requirementCount }} terminados · {{ p.assignedCount }} con técnico · creada el {{ p.createdAt | day }}
                </span>
                @if (p.goal === 'PRE_RENTAL') {
                  <span class="row-meta">
                    Pre-arriendo{{ p.targetRent ? ' · canon meta ' : '' }}{{ p.targetRent ? (p.targetRent | money) : '' }}
                    @if (p.listingPublishedAt) { · aviso publicado }
                  </span>
                }
              </a>
            </li>
          }
        </ul>
      } @else {
        <app-empty title="Aún no tienes remodelaciones" text="Agrupa en una obra los arreglos de distintos oficios: pintura, plomería, electricidad.">
          <a routerLink="/remodelings/new" class="btn btn-primary">Crear remodelación</a>
        </app-empty>
      }
    </div>
  `,
  styles: `
    .projects { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s-3); grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); }
    .project { display: grid; gap: var(--s-3); color: inherit; text-decoration: none; height: 100%; }
    .project:hover { border-color: var(--border-control); }
    .meter { display: flex; height: 8px; border-radius: 4px; background: var(--surface-2); overflow: hidden; }
    .meter .done { background: var(--success); }
    .meter .assigned { background: var(--accent); }
  `
})
export class RemodelingsPage {
  private readonly api = inject(ProjectsApi);
  readonly projects = rxResource({ stream: () => this.api.remodelings() });
  readonly status = REMODELING_STATUS;
}
