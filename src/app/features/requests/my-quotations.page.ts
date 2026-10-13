import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { RequestsApi } from '../../data/requests.api';
import { QUOTATION_STATUS } from '../../shared/format';
import { AgoPipe, MoneyPipe } from '../../shared/ui/pipes';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { StatusComponent } from '../../shared/ui/status.component';

type Filter = 'SUBMITTED' | 'ACCEPTED' | 'REJECTED';

@Component({
  selector: 'app-my-quotations-page',
  imports: [RouterLink, StatusComponent, MoneyPipe, AgoPipe, LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>Mis cotizaciones</h1>
          <p class="lede">Lo que ofreciste y qué decidió cada cliente.</p>
        </div>
      </header>
      @if (quotations.isLoading() && !quotations.hasValue()) {
        <app-loading />
      } @else if (quotations.error()) {
        <app-error (retry)="quotations.reload()" />
      } @else if (quotations.hasValue() && quotations.value().length) {
        <div class="tabs" role="tablist">
          @for (tab of tabs; track tab.key) {
            <button type="button" role="tab" [attr.aria-selected]="filter() === tab.key" (click)="filter.set(tab.key)">
              {{ tab.label }} <span class="count">{{ count(tab.key) }}</span>
            </button>
          }
        </div>
        <div class="panel table-panel">
          <table class="table">
            <thead><tr><th scope="col">Solicitud</th><th scope="col" class="num">Valor</th><th scope="col">Días</th><th scope="col">Enviada</th><th scope="col">Estado</th></tr></thead>
            <tbody>
              @for (q of visible(); track q.id) {
                <tr>
                  <td data-label="Solicitud"><a [routerLink]="['/requests', q.requestId]" class="link">{{ q.requestTitle || 'Ver solicitud' }}</a></td>
                  <td data-label="Valor" class="num">{{ q.amount | money }}</td>
                  <td data-label="Días">{{ q.estimatedDays }}</td>
                  <td data-label="Enviada">{{ q.createdAt | ago }}</td>
                  <td data-label="Estado"><app-status [map]="status" [value]="q.status" /></td>
                </tr>
              }
            </tbody>
          </table>
          @if (!visible().length) { <p class="text-muted empty-filter">Nada en este estado.</p> }
        </div>
      } @else {
        <app-empty title="Aún no has cotizado" text="Busca en las solicitudes disponibles de tu especialidad y envía tu primera cotización.">
          <a routerLink="/requests/inbox" class="btn btn-primary">Ver solicitudes disponibles</a>
        </app-empty>
      }
    </div>
  `,
  styles: `.table-panel { padding: var(--s-2) var(--s-4); } .empty-filter { padding: var(--s-4) 0; }`
})
export class MyQuotationsPage {
  private readonly api = inject(RequestsApi);
  readonly quotations = rxResource({ stream: () => this.api.myQuotations() });
  readonly status = QUOTATION_STATUS;
  readonly filter = signal<Filter>('SUBMITTED');
  readonly tabs: { key: Filter; label: string }[] = [
    { key: 'SUBMITTED', label: 'Esperando respuesta' },
    { key: 'ACCEPTED', label: 'Aceptadas' },
    { key: 'REJECTED', label: 'No elegidas' }
  ];
  readonly visible = computed(() =>
    this.quotations.hasValue()
      ? [...this.quotations.value()].filter((q) => q.status === this.filter()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      : []
  );

  count(filter: Filter): number {
    return this.quotations.hasValue() ? this.quotations.value().filter((q) => q.status === filter).length : 0;
  }
}
