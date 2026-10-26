import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { RequestsApi } from '../../data/requests.api';
import { REQUEST_STATUS, SLA_STATE, SPECIALTY, URGENCY } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { AgoPipe, DayPipe, LabelPipe } from '../../shared/ui/pipes';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { StatusComponent } from '../../shared/ui/status.component';

type Filter = 'ACTIVE' | 'COMPLETED' | 'ALL';

@Component({
  selector: 'app-my-requests-page',
  imports: [RouterLink, IconComponent, StatusComponent, LabelPipe, DayPipe, AgoPipe, LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>Solicitudes de reparación</h1>
          <p class="lede">{{ lede() }}</p>
        </div>
        <div class="actions">
          <a routerLink="/requests/new" class="btn btn-primary"><app-icon name="plus" />Reportar un daño</a>
        </div>
      </header>

      @if (requests.isLoading() && !requests.hasValue()) {
        <app-loading text="Cargando solicitudes…" />
      } @else if (requests.error()) {
        <app-error (retry)="requests.reload()" />
      } @else if (requests.hasValue()) {
        @if (requests.value().length) {
          <div class="tabs" role="tablist" aria-label="Estado de la solicitud">
            @for (tab of tabs; track tab.key) {
              <button type="button" role="tab" [attr.aria-selected]="filter() === tab.key" (click)="filter.set(tab.key)">
                {{ tab.label }} <span class="count">{{ count(tab.key) }}</span>
              </button>
            }
          </div>
          <ul class="list panel request-list">
            @for (r of visible(); track r.requestId) {
              <li>
                <a [routerLink]="['/requests', r.requestId]" class="row-link">
                  <span class="stack-sm grow">
                    <span class="row-title">{{ r.title }}</span>
                    <span class="row-meta">
                      {{ r.specialty | label: specialty }} · {{ r.propertyName || r.propertyCity }}
                      @if (r.requestedByName && r.requestedByUserId !== r.ownerUserId) { · reportó {{ r.requestedByName }} }
                    </span>
                    <span class="row-meta">
                      Creada {{ r.createdAt | ago }}
                      @if (r.assignedFixerName) { · técnico {{ r.assignedFixerName }} }
                    </span>
                  </span>
                  <span class="badges">
                    <app-status [map]="status" [value]="r.status" />
                    @if (r.status !== 'COMPLETED' && r.status !== 'CANCELLED') {
                      <app-status [map]="urgency" [value]="r.urgencyLevel" />
                      @if (r.slaDeadline && (r.slaState === 'WARNING' || r.slaState === 'BREACHED')) {
                        <span class="text-xs" [class.late]="r.slaState === 'BREACHED'">Plazo {{ r.slaDeadline | day: 'short' }}</span>
                      }
                    }
                  </span>
                </a>
              </li>
            } @empty {
              <li class="text-muted empty-filter">No hay solicitudes en este estado.</li>
            }
          </ul>
        } @else {
          <app-empty title="Aún no hay solicitudes" text="Cuando algo se dañe en un inmueble, repórtalo con fotos y los técnicos de la especialidad podrán cotizar.">
            <a routerLink="/requests/new" class="btn btn-primary">Reportar un daño</a>
          </app-empty>
        }
      }
    </div>
  `,
  styles: `
    .request-list { padding: 0 var(--s-4); }
    .grow { flex: 1; min-width: 0; }
    .badges { display: flex; flex-direction: column; align-items: flex-end; gap: var(--s-1); }
    .late { color: var(--danger); font-weight: 600; }
    .empty-filter { padding: var(--s-4) 0; }
  `
})
export class MyRequestsPage {
  private readonly api = inject(RequestsApi);
  private readonly user = inject(CurrentUserStore);

  readonly requests = rxResource({ stream: () => this.api.mine() });
  readonly filter = signal<Filter>('ACTIVE');
  readonly status = REQUEST_STATUS;
  readonly urgency = URGENCY;
  readonly sla = SLA_STATE;
  readonly specialty = SPECIALTY;
  readonly tabs: { key: Filter; label: string }[] = [
    { key: 'ACTIVE', label: 'En curso' },
    { key: 'COMPLETED', label: 'Cerradas' },
    { key: 'ALL', label: 'Todas' }
  ];

  readonly lede = computed(() =>
    this.user.activeRole() === 'TENANT'
      ? 'Los daños que reportaste en el inmueble que arriendas y cómo avanza cada uno.'
      : 'Daños reportados en tus inmuebles. Compara cotizaciones y sigue cada arreglo hasta el pago.'
  );

  readonly visible = computed(() => {
    if (!this.requests.hasValue()) return [];
    return [...this.requests.value()]
      .filter((r) => this.matches(r.status, this.filter()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  count(filter: Filter): number {
    return this.requests.hasValue() ? this.requests.value().filter((r) => this.matches(r.status, filter)).length : 0;
  }

  private matches(status: string, filter: Filter): boolean {
    const closed = status === 'COMPLETED' || status === 'CANCELLED';
    return filter === 'ALL' || (filter === 'COMPLETED' ? closed : !closed);
  }
}
