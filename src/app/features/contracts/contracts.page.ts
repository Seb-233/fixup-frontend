import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { ContractResponse } from '../../data/models';
import { ProjectsApi } from '../../data/projects.api';
import { CONTRACT_STATUS } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { DayPipe, MoneyPipe } from '../../shared/ui/pipes';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { StatusComponent } from '../../shared/ui/status.component';

type Filter = 'CURRENT' | 'CLOSED';

export function daysUntil(dateText: string | undefined): number | null {
  if (!dateText) return null;
  const end = new Date(`${dateText}T23:59:59`);
  return Math.ceil((end.getTime() - Date.now()) / (24 * 3600 * 1000));
}

@Component({
  selector: 'app-contracts-page',
  imports: [RouterLink, IconComponent, StatusComponent, MoneyPipe, DayPipe, LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>{{ isTenant() ? 'Mi contrato' : 'Contratos de arriendo' }}</h1>
          <p class="lede">{{ isTenant() ? 'El contrato del inmueble que arriendas: fechas, canon y día de pago.' : 'Contratos de tus inmuebles. Te avisamos 30 y 7 días antes de que venza cada uno.' }}</p>
        </div>
        @if (!isTenant()) {
          <div class="actions"><a routerLink="/contracts/new" class="btn btn-primary"><app-icon name="plus" />Nuevo contrato</a></div>
        }
      </header>

      @if (contracts.isLoading() && !contracts.hasValue()) {
        <app-loading text="Cargando contratos…" />
      } @else if (contracts.error()) {
        <app-error (retry)="contracts.reload()" />
      } @else if (contracts.hasValue() && contracts.value().length) {
        <div class="tabs" role="tablist">
          <button type="button" role="tab" [attr.aria-selected]="filter() === 'CURRENT'" (click)="filter.set('CURRENT')">Vigentes <span class="count">{{ count('CURRENT') }}</span></button>
          <button type="button" role="tab" [attr.aria-selected]="filter() === 'CLOSED'" (click)="filter.set('CLOSED')">Cerrados <span class="count">{{ count('CLOSED') }}</span></button>
        </div>
        <ul class="list panel contracts">
          @for (c of visible(); track c.id) {
            <li>
              <a [routerLink]="['/contracts', c.id]" class="row-link">
                <span class="stack-sm grow">
                  <span class="row-title">{{ c.propertyName || 'Inmueble' }}</span>
                  <span class="row-meta">{{ c.propertyAddress }}{{ c.propertyCity ? ', ' + c.propertyCity : '' }}</span>
                  <span class="row-meta">
                    {{ isTenant() ? 'Arrendador: ' + (c.ownerName || '—') : 'Arrendatario: ' + (c.tenantName || '—') }} ·
                    {{ c.startDate | day }} a {{ c.endDate | day }}
                  </span>
                </span>
                <span class="side">
                  <span class="price">{{ c.monthlyRentAmount | money }}</span>
                  <app-status [map]="status" [value]="c.status" />
                  @if (expiringIn(c); as days) { <span class="text-xs warn">Vence en {{ days }} {{ days === 1 ? 'día' : 'días' }}</span> }
                </span>
              </a>
            </li>
          } @empty {
            <li class="text-muted empty-filter">Nada en este estado.</li>
          }
        </ul>
      } @else {
        <app-empty [title]="isTenant() ? 'No tienes contratos registrados' : 'Aún no hay contratos'"
                   [text]="isTenant() ? 'Cuando tu arrendador registre el contrato en Fix&Rent aparecerá aquí y podrás reportar daños del inmueble.' : 'Registra el contrato de un inmueble con el correo del arrendatario.'">
          @if (!isTenant()) { <a routerLink="/contracts/new" class="btn btn-primary">Crear contrato</a> }
        </app-empty>
      }
    </div>
  `,
  styles: `
    .contracts { padding: 0 var(--s-4); }
    .grow { flex: 1; min-width: 0; }
    .side { display: grid; justify-items: end; gap: var(--s-1); }
    .warn { color: var(--warning); font-weight: 600; }
    .empty-filter { padding: var(--s-4) 0; }
  `
})
export class ContractsPage {
  private readonly api = inject(ProjectsApi);
  private readonly user = inject(CurrentUserStore);
  readonly contracts = rxResource({ stream: () => this.api.contracts() });
  readonly filter = signal<Filter>('CURRENT');
  readonly status = CONTRACT_STATUS;
  readonly isTenant = computed(() => this.user.activeRole() === 'TENANT');

  readonly visible = computed(() =>
    this.contracts.hasValue()
      ? this.contracts.value().filter((c) => this.bucket(c) === this.filter()).sort((a, b) => (a.endDate ?? '').localeCompare(b.endDate ?? ''))
      : []
  );

  count(filter: Filter): number {
    return this.contracts.hasValue() ? this.contracts.value().filter((c) => this.bucket(c) === filter).length : 0;
  }

  expiringIn(contract: ContractResponse): number | null {
    if (this.bucket(contract) !== 'CURRENT') return null;
    const days = daysUntil(contract.endDate);
    return days !== null && days >= 0 && days <= 60 ? days : null;
  }

  private bucket(contract: ContractResponse): Filter {
    return contract.status === 'ACTIVE' || contract.status === 'RENEWED' || contract.status === 'DRAFT' ? 'CURRENT' : 'CLOSED';
  }
}
