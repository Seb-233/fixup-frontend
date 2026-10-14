import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ProjectsApi } from '../../data/projects.api';
import { JOB_STATUS, REMODELING_STATUS, REQUEST_STATUS, SPECIALTY, errorMessage } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { DayPipe, LabelPipe, MoneyPipe } from '../../shared/ui/pipes';
import { ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { StatusComponent } from '../../shared/ui/status.component';

@Component({
  selector: 'app-remodeling-detail-page',
  imports: [RouterLink, IconComponent, StatusComponent, LabelPipe, DayPipe, MoneyPipe, LoadingComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <a routerLink="/remodelings" class="back-link"><app-icon name="chevron-left" [size]="16" />Remodelaciones</a>
      @if (project.isLoading() && !project.hasValue()) {
        <app-loading text="Cargando la obra…" />
      } @else if (project.error()) {
        <app-error title="No pudimos abrir la remodelación" (retry)="project.reload()" />
      } @else if (project.hasValue()) {
        @let p = project.value();
        <header class="page-header">
          <div>
            <app-status [map]="status" [value]="p.status" />
            <h1 class="title">{{ p.title }}</h1>
            @if (p.description) { <p class="lede">{{ p.description }}</p> }
          </div>
        </header>

        <section class="panel">
          <dl class="facts">
            <div><dt>Requerimientos</dt><dd>{{ p.requirementCount }}</dd></div>
            <div><dt>Con técnico</dt><dd>{{ p.assignedCount }}</dd></div>
            <div><dt>Terminados</dt><dd>{{ p.completedCount }}</dd></div>
            <div><dt>Creada</dt><dd>{{ p.createdAt | day }}</dd></div>
          </dl>
        </section>

        @if (p.goal === 'PRE_RENTAL') {
          <section class="panel stack-sm" [class.ready]="p.readyToPublish && !p.listingPublishedAt">
            <h2 class="text-lg">Listo para arrendar</h2>
            <p class="text-sm">
              Canon meta {{ p.targetRent | money }}{{ p.targetReadyDate ? ' · fecha objetivo ' : '' }}{{ p.targetReadyDate ? (p.targetReadyDate | day) : '' }}.
            </p>
            @if (p.listingPublishedAt) {
              <p class="text-sm">Publicaste el aviso de arriendo el {{ p.listingPublishedAt | day }}.</p>
              <div><a [routerLink]="['/catalog', p.propertyId]" class="btn btn-secondary">Ver el aviso</a></div>
            } @else if (p.readyToPublish) {
              <p class="text-sm">Todos los requerimientos terminaron. Publica el inmueble en arriendo con el canon meta.</p>
              <div><button type="button" class="btn btn-primary" (click)="publish()" [disabled]="busy()">Publicar aviso de arriendo</button></div>
            } @else {
              <p class="text-sm text-muted">Podrás publicar el aviso cuando terminen todos los requerimientos.</p>
            }
            @if (message()) { <p class="text-sm" role="status">{{ message() }}</p> }
          </section>
        }

        <section class="stack-sm" aria-labelledby="req-title">
          <h2 id="req-title">Requerimientos</h2>
          <ol class="list panel reqs">
            @for (r of requirements(); track r.requirementId) {
              <li>
                <a [routerLink]="['/requests', r.requestId]" class="row-link">
                  <span class="num-badge">{{ r.position + 1 }}</span>
                  <span class="stack-sm grow">
                    <span class="row-title">{{ r.specialty | label: specialty }}</span>
                    <span class="row-meta">{{ r.jobStatus ? 'Trabajo: ' + (r.jobStatus | label: jobText) : 'Sin trabajo asignado' }}</span>
                  </span>
                  <app-status [map]="requestStatus" [value]="r.requestStatus" />
                  <app-icon name="chevron-right" />
                </a>
              </li>
            }
          </ol>
        </section>
      }
    </div>
  `,
  styles: `
    .title { margin-top: var(--s-2); }
    .ready { border-color: var(--success); }
    .reqs { padding: 0 var(--s-4); }
    .grow { flex: 1; min-width: 0; }
    .num-badge { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--surface-2); font-weight: 700; font-size: var(--fs-sm); flex: none; }
  `
})
export class RemodelingDetailPage {
  private readonly api = inject(ProjectsApi);
  readonly projectId = input.required<string>();
  readonly project = rxResource({ params: () => this.projectId(), stream: ({ params }) => this.api.remodeling(params) });
  readonly status = REMODELING_STATUS;
  readonly requestStatus = REQUEST_STATUS;
  readonly specialty = SPECIALTY;
  readonly jobText = Object.fromEntries(Object.entries(JOB_STATUS).map(([k, v]) => [k, v.text]));
  readonly requirements = computed(() => (this.project.hasValue() ? [...this.project.value().requirements].sort((a, b) => a.position - b.position) : []));
  readonly busy = signal(false);
  readonly message = signal<string | null>(null);

  publish(): void {
    this.busy.set(true);
    this.api.publishRemodelingListing(this.projectId()).subscribe({
      next: (project) => {
        this.busy.set(false);
        this.project.set(project);
        this.message.set('El inmueble ya está en el catálogo como arriendo.');
      },
      error: (failure) => {
        this.busy.set(false);
        this.message.set(errorMessage(failure, 'No pudimos publicar el aviso.'));
      }
    });
  }
}
