import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { RequestsApi } from '../../data/requests.api';
import { SPECIALTY, URGENCY } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { AgoPipe, LabelPipe, WhenPipe } from '../../shared/ui/pipes';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { StatusComponent } from '../../shared/ui/status.component';

const URGENCY_ORDER: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

@Component({
  selector: 'app-inbox-page',
  imports: [RouterLink, IconComponent, StatusComponent, LabelPipe, AgoPipe, WhenPipe, LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>Solicitudes disponibles</h1>
          <p class="lede">Daños abiertos de tus especialidades en tu ciudad. Primero las invitaciones de inmobiliarias y las más urgentes.</p>
        </div>
        <div class="actions">
          <button type="button" class="btn btn-ghost" (click)="open.reload()"><app-icon name="refresh" />Actualizar</button>
        </div>
      </header>

      @if (open.isLoading() && !open.hasValue()) {
        <app-loading text="Buscando solicitudes…" />
      } @else if (open.error()) {
        <app-error (retry)="open.reload()" />
      } @else if (sorted().length) {
        <ul class="list panel inbox">
          @for (r of sorted(); track r.requestId) {
            <li>
              <a [routerLink]="['/requests', r.requestId]" class="row-link">
                <span class="stack-sm grow">
                  <span class="cluster">
                    <span class="row-title">{{ r.title }}</span>
                    @if (r.invited) { <span class="chip chip-accent">Te invitaron</span> }
                  </span>
                  <span class="row-meta">{{ r.specialty | label: specialty }} · {{ r.propertyCity || 'Ciudad sin indicar' }} · publicada {{ r.createdAt | ago }}</span>
                  @if (r.slaDeadline) { <span class="row-meta">Plazo de atención: {{ r.slaDeadline | when }}</span> }
                </span>
                <app-status [map]="urgency" [value]="r.urgencyLevel" />
                <app-icon name="chevron-right" />
              </a>
            </li>
          }
        </ul>
      } @else {
        <app-empty title="No hay solicitudes abiertas para ti" text="Cuando se reporte un daño de tus especialidades en tu ciudad aparecerá aquí. Revisa que tu ciudad esté al día en tu perfil.">
          <a routerLink="/profile" class="btn btn-secondary">Revisar mi perfil</a>
        </app-empty>
      }
    </div>
  `,
  styles: `.inbox { padding: 0 var(--s-4); } .grow { flex: 1; min-width: 0; }`
})
export class InboxPage {
  private readonly api = inject(RequestsApi);
  readonly open = rxResource({ stream: () => this.api.open() });
  readonly specialty = SPECIALTY;
  readonly urgency = URGENCY;

  readonly sorted = computed(() => {
    if (!this.open.hasValue()) return [];
    return [...this.open.value()].sort(
      (a, b) =>
        Number(b.invited) - Number(a.invited) ||
        (URGENCY_ORDER[a.urgencyLevel] ?? 9) - (URGENCY_ORDER[b.urgencyLevel] ?? 9) ||
        a.createdAt.localeCompare(b.createdAt)
    );
  });
}
