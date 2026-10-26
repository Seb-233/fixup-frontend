import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { WorkApi } from '../../data/work.api';
import { JOB_STATUS, SPECIALTY } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { DayPipe, LabelPipe, WhenPipe } from '../../shared/ui/pipes';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { StatusComponent } from '../../shared/ui/status.component';

type Filter = 'ACTIVE' | 'COMPLETED';

@Component({
  selector: 'app-my-jobs-page',
  imports: [RouterLink, IconComponent, StatusComponent, LabelPipe, WhenPipe, DayPipe, LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>Mis trabajos</h1>
          <p class="lede">Trabajos que te asignaron al aceptar tu cotización. Agenda la fecha, registra el avance con fotos y ciérralos al terminar.</p>
        </div>
      </header>
      @if (jobs.isLoading() && !jobs.hasValue()) {
        <app-loading text="Cargando trabajos…" />
      } @else if (jobs.error()) {
        <app-error (retry)="jobs.reload()" />
      } @else if (jobs.hasValue() && jobs.value().length) {
        <div class="tabs" role="tablist">
          <button type="button" role="tab" [attr.aria-selected]="filter() === 'ACTIVE'" (click)="filter.set('ACTIVE')">Activos <span class="count">{{ active().length }}</span></button>
          <button type="button" role="tab" [attr.aria-selected]="filter() === 'COMPLETED'" (click)="filter.set('COMPLETED')">Terminados <span class="count">{{ completed().length }}</span></button>
        </div>
        <ul class="list panel jobs">
          @for (j of (filter() === 'ACTIVE' ? active() : completed()); track j.id) {
            <li>
              <a [routerLink]="['/jobs', j.id]" class="row-link">
                <span class="stack-sm grow">
                  <span class="row-title">{{ j.requestTitle || 'Trabajo' }}</span>
                  <span class="row-meta">{{ j.specialty | label: specialty }} · {{ j.ownerName }} · {{ j.propertyName }}{{ j.propertyCity ? ', ' + j.propertyCity : '' }}</span>
                  <span class="row-meta">
                    @if (j.completedAt) { Terminado el {{ j.completedAt | day }} }
                    @else if (j.scheduledFor) { Agendado para {{ j.scheduledFor | when }} }
                    @else { Sin fecha acordada }
                  </span>
                </span>
                <app-status [map]="status" [value]="j.status" />
                <app-icon name="chevron-right" />
              </a>
            </li>
          } @empty {
            <li class="text-muted empty-filter">Nada en este estado.</li>
          }
        </ul>
      } @else {
        <app-empty title="Aún no tienes trabajos" text="Cuando un cliente acepte una de tus cotizaciones, el trabajo aparecerá aquí.">
          <a routerLink="/requests/inbox" class="btn btn-primary">Buscar solicitudes</a>
        </app-empty>
      }
    </div>
  `,
  styles: `.jobs { padding: 0 var(--s-4); } .grow { flex: 1; min-width: 0; } .empty-filter { padding: var(--s-4) 0; }`
})
export class MyJobsPage {
  private readonly api = inject(WorkApi);
  readonly jobs = rxResource({ stream: () => this.api.myJobs() });
  readonly filter = signal<Filter>('ACTIVE');
  readonly status = JOB_STATUS;
  readonly specialty = SPECIALTY;
  readonly active = computed(() =>
    this.jobs.hasValue()
      ? this.jobs.value().filter((j) => j.status !== 'COMPLETED').sort((a, b) => (a.scheduledFor ?? '9').localeCompare(b.scheduledFor ?? '9'))
      : []
  );
  readonly completed = computed(() =>
    this.jobs.hasValue()
      ? this.jobs.value().filter((j) => j.status === 'COMPLETED').sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
      : []
  );
}
