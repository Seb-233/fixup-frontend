import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { PropertiesApi } from '../../data/properties.api';
import { PropertySummary } from '../../data/models';
import { LISTING_TYPE, PROPERTY_STATUS, PROPERTY_TYPE, errorMessage } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { LabelPipe, MoneyPipe } from '../../shared/ui/pipes';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { StatusComponent } from '../../shared/ui/status.component';

type Filter = 'ALL' | 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';

@Component({
  selector: 'app-my-properties-page',
  imports: [RouterLink, IconComponent, StatusComponent, LabelPipe, MoneyPipe, LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>{{ isManager() ? 'Inmuebles' : 'Mis inmuebles' }}</h1>
          <p class="lede">
            {{ isManager() ? 'Los inmuebles de tu inmobiliaria y los que te delegaron sus propietarios.' : 'Publica, edita o retira tus avisos del catálogo.' }}
          </p>
        </div>
        <div class="actions">
          <a routerLink="/properties/new" class="btn btn-primary"><app-icon name="plus" />Nuevo inmueble</a>
        </div>
      </header>

      @if (properties.isLoading() && !properties.hasValue()) {
        <app-loading text="Cargando inmuebles…" />
      } @else if (properties.error()) {
        <app-error (retry)="properties.reload()" />
      } @else if (properties.hasValue()) {
        @if (properties.value().length) {
          <div class="tabs" role="tablist" aria-label="Estado del aviso">
            @for (tab of tabs; track tab.key) {
              <button type="button" role="tab" [attr.aria-selected]="filter() === tab.key" (click)="filter.set(tab.key)">
                {{ tab.label }} <span class="count">{{ count(tab.key) }}</span>
              </button>
            }
          </div>

          @if (message()) {
            <div class="alert" [class.alert-danger]="messageIsError()" [class.alert-success]="!messageIsError()" role="status">{{ message() }}</div>
          }

          <div class="panel table-panel">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col">Inmueble</th>
                  <th scope="col">Tipo</th>
                  <th scope="col" class="num">Precio</th>
                  <th scope="col">Estado</th>
                  <th scope="col"><span class="visually-hidden">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                @for (p of visible(); track p.id) {
                  <tr>
                    <td data-label="Inmueble">
                      <div class="stack-sm cell-main">
                        <strong>{{ p.name }}</strong>
                        <span class="text-muted">{{ p.address }}, {{ p.city }}</span>
                        @if (isManager() && p.ownerUserId !== me()) {
                          <span class="chip chip-info">Delegado por su propietario</span>
                        }
                      </div>
                    </td>
                    <td data-label="Tipo">{{ p.propertyType | label: propertyType }} · {{ p.listingType | label: listingType }}</td>
                    <td data-label="Precio" class="num">{{ p.price | money }}</td>
                    <td data-label="Estado"><app-status [map]="status" [value]="p.status" /></td>
                    <td data-label="Acciones">
                      <div class="row-actions">
                        <a [routerLink]="['/properties', p.id, 'edit']" class="btn btn-ghost">Editar</a>
                        @if (p.status === 'PUBLISHED') {
                          <a [routerLink]="['/catalog', p.id]" class="btn btn-ghost">Ver aviso</a>
                          <button type="button" class="btn btn-ghost" (click)="toggle(p)" [disabled]="busy() === p.id">Retirar</button>
                        } @else {
                          <button type="button" class="btn btn-secondary" (click)="toggle(p)" [disabled]="busy() === p.id">Publicar</button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            @if (!visible().length) {
              <p class="text-muted empty-filter">No hay inmuebles en este estado.</p>
            }
          </div>
        } @else {
          <app-empty title="Aún no tienes inmuebles" text="Crea el primero con fotos, precio y ubicación. Puedes guardarlo sin publicar.">
            <a routerLink="/properties/new" class="btn btn-primary">Crear inmueble</a>
          </app-empty>
        }
      }
    </div>
  `,
  styles: `
    .table-panel { padding: var(--s-2) var(--s-4); }
    .cell-main { min-width: 0; }
    .row-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--s-1); }
    .empty-filter { padding: var(--s-4) 0; }
  `
})
export class MyPropertiesPage {
  private readonly api = inject(PropertiesApi);
  private readonly user = inject(CurrentUserStore);

  readonly properties = rxResource({ stream: () => this.api.mine() });
  readonly filter = signal<Filter>('ALL');
  readonly busy = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly messageIsError = signal(false);
  readonly status = PROPERTY_STATUS;
  readonly propertyType = PROPERTY_TYPE;
  readonly listingType = LISTING_TYPE;
  readonly isManager = computed(() => this.user.activeRole() === 'REAL_ESTATE_MANAGER');
  readonly me = computed(() => this.user.user()?.id);
  readonly tabs: { key: Filter; label: string }[] = [
    { key: 'ALL', label: 'Todos' },
    { key: 'PUBLISHED', label: 'Publicados' },
    { key: 'DRAFT', label: 'Sin publicar' },
    { key: 'ARCHIVED', label: 'Retirados' }
  ];

  readonly visible = computed(() => {
    if (!this.properties.hasValue()) return [];
    const f = this.filter();
    return this.properties.value().filter((p) => f === 'ALL' || p.status === f);
  });

  count(filter: Filter): number {
    if (!this.properties.hasValue()) return 0;
    return this.properties.value().filter((p) => filter === 'ALL' || p.status === filter).length;
  }

  toggle(property: PropertySummary): void {
    this.busy.set(property.id);
    this.message.set(null);
    const action = property.status === 'PUBLISHED' ? this.api.unpublish(property.id) : this.api.publish(property.id);
    action.subscribe({
      next: (updated) => {
        this.busy.set(null);
        this.properties.update((list) => list?.map((p) => (p.id === updated.id ? updated : p)));
        this.messageIsError.set(false);
        this.message.set(updated.status === 'PUBLISHED' ? `${updated.name} ya está en el catálogo.` : `${updated.name} salió del catálogo.`);
      },
      error: (failure) => {
        this.busy.set(null);
        this.messageIsError.set(true);
        this.message.set(errorMessage(failure, 'No pudimos cambiar la publicación. Revisa que el aviso tenga precio y ubicación.'));
      }
    });
  }
}
