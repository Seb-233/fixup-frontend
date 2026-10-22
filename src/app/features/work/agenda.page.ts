import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { VisitResponse } from '../../data/models';
import { WorkApi } from '../../data/work.api';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { VisitCardComponent } from './visit-card.component';

type Filter = 'UPCOMING' | 'TO_CONFIRM' | 'PAST';

const DAY = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });

@Component({
  selector: 'app-agenda-page',
  imports: [VisitCardComponent, LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <header class="page-header">
        <div>
          <h1>Agenda de visitas</h1>
          <p class="lede">Diagnósticos y visitas de ejecución en las solicitudes donde participas. Una visita propuesta necesita la confirmación de la otra parte.</p>
        </div>
      </header>

      @if (visits.isLoading() && !visits.hasValue()) {
        <app-loading text="Cargando agenda…" />
      } @else if (visits.error()) {
        <app-error (retry)="visits.reload()" />
      } @else if (visits.hasValue() && visits.value().length) {
        <div class="tabs" role="tablist">
          @for (tab of tabs; track tab.key) {
            <button type="button" role="tab" [attr.aria-selected]="filter() === tab.key" (click)="filter.set(tab.key)">
              {{ tab.label }} <span class="count">{{ count(tab.key) }}</span>
            </button>
          }
        </div>
        @for (group of groups(); track group.day) {
          <section class="stack-sm" [attr.aria-label]="group.day">
            <h2 class="day">{{ group.day }}</h2>
            @for (v of group.items; track v.id) {
              <app-visit-card [visit]="v" [me]="me()" [showRequestLink]="true" (changed)="onChanged($event)" />
            }
          </section>
        } @empty {
          <p class="text-muted">Nada en esta vista.</p>
        }
      } @else {
        <app-empty title="Sin visitas" text="Las visitas se proponen desde el detalle de una solicitud, con un técnico que ya cotizó o con el técnico asignado." />
      }
    </div>
  `,
  styles: `
    .day { font-size: var(--fs-base); color: var(--text-muted); margin-top: var(--s-3); }
    .day::first-letter { text-transform: uppercase; }
  `
})
export class AgendaPage {
  private readonly api = inject(WorkApi);
  private readonly user = inject(CurrentUserStore);
  readonly me = computed(() => this.user.user()?.id);
  readonly visits = rxResource({ stream: () => this.api.myVisits() });
  readonly filter = signal<Filter>('UPCOMING');
  readonly tabs: { key: Filter; label: string }[] = [
    { key: 'UPCOMING', label: 'Próximas' },
    { key: 'TO_CONFIRM', label: 'Por confirmar' },
    { key: 'PAST', label: 'Historial' }
  ];

  readonly groups = computed(() => {
    if (!this.visits.hasValue()) return [];
    const items = this.visits.value().filter((v) => this.matches(v, this.filter()));
    items.sort((a, b) => (this.filter() === 'PAST' ? b.scheduledAt.localeCompare(a.scheduledAt) : a.scheduledAt.localeCompare(b.scheduledAt)));
    const groups: { day: string; items: VisitResponse[] }[] = [];
    for (const visit of items) {
      const day = DAY.format(new Date(visit.scheduledAt));
      const last = groups[groups.length - 1];
      if (last?.day === day) last.items.push(visit);
      else groups.push({ day, items: [visit] });
    }
    return groups;
  });

  count(filter: Filter): number {
    return this.visits.hasValue() ? this.visits.value().filter((v) => this.matches(v, filter)).length : 0;
  }

  onChanged(visit: VisitResponse): void {
    this.visits.update((list) => (list ?? []).map((v) => (v.id === visit.id ? visit : v)));
  }

  private matches(visit: VisitResponse, filter: Filter): boolean {
    const open = visit.status === 'PROPOSED' || visit.status === 'CONFIRMED';
    if (filter === 'TO_CONFIRM') return visit.status === 'PROPOSED' && visit.proposedByUserId !== this.me();
    if (filter === 'UPCOMING') return open;
    return !open;
  }
}
