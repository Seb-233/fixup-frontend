import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdministrationApi } from '../../data/administration.api';
import { AuditedResourceType, StatusChangeEntry } from '../../data/models';
import { AUDITED_RESOURCE_TYPE, AUDIT_STATUS_BY_RESOURCE, CONTRACT_STATUS, JOB_STATUS, Label, PAYMENT_STATUS, REQUEST_STATUS, errorMessage } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { AgoPipe, LabelPipe, WhenPipe } from '../../shared/ui/pipes';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { StatusComponent } from '../../shared/ui/status.component';

type ResourceFilter = '' | AuditedResourceType;

interface AuditFilters {
  resourceType: ResourceFilter;
  resourceId: string;
  limit: 50 | 100 | 200 | 500;
}

@Component({
  selector: 'app-audit-log-page',
  imports: [FormsModule, RouterLink, IconComponent, StatusComponent, LabelPipe, WhenPipe, AgoPipe, LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>Bitácora de estados</h1>
          <p class="lede">Consulta centralizada y de solo lectura para revisar los cambios de estado de solicitudes, pagos, contratos y trabajos.</p>
        </div>
        <div class="actions">
          <button type="button" class="btn btn-ghost" (click)="audit.reload()"><app-icon name="refresh" />Actualizar</button>
        </div>
      </header>

      <section class="panel filters-panel">
        <div class="panel-note">
          <app-icon name="info" [size]="18" />
          <p>Esta pantalla automatiza la consulta administrativa de la bitácora. Desde aquí no se puede editar ni borrar ningún registro.</p>
        </div>

        <form class="filters" (ngSubmit)="applyFilters()">
          <div class="field">
            <label for="audit-resource-type">Tipo de recurso</label>
            <select id="audit-resource-type" class="select" name="resourceType" [(ngModel)]="form.resourceType">
              <option value="">Todos</option>
              @for (option of resourceTypes; track option) {
                <option [value]="option">{{ option | label: resourceTypeLabel }}</option>
              }
            </select>
          </div>

          <div class="field grow">
            <label for="audit-resource-id">Id del recurso</label>
            <input
              id="audit-resource-id"
              class="input mono"
              type="text"
              name="resourceId"
              autocomplete="off"
              placeholder="UUID exacto del recurso"
              [(ngModel)]="form.resourceId"
            />
          </div>

          <div class="field">
            <label for="audit-limit">Límite</label>
            <select id="audit-limit" class="select" name="limit" [(ngModel)]="form.limit">
              @for (limit of limitOptions; track limit) {
                <option [ngValue]="limit">{{ limit }} registros</option>
              }
            </select>
          </div>

          <div class="filter-actions">
            <button type="submit" class="btn btn-primary"><app-icon name="filter" />Aplicar</button>
            <button type="button" class="btn btn-ghost" (click)="resetFilters()">Limpiar</button>
          </div>
        </form>

        <p class="text-xs text-muted">Si filtras por id, elige primero el tipo de recurso para hacer una consulta precisa.</p>
        @if (validationError()) {
          <div class="alert alert-danger" role="alert">{{ validationError() }}</div>
        }
      </section>

      @if (audit.isLoading() && !audit.hasValue()) {
        <app-loading text="Cargando bitácora…" />
      } @else if (audit.error()) {
        <app-error [message]="loadError()" (retry)="audit.reload()" />
      } @else if (audit.hasValue() && audit.value().length) {
        <section class="stats">
          @for (item of stats(); track item.label) {
            <article class="panel stat-card">
              <span class="text-xs text-muted">{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </article>
          }
        </section>

        <section class="panel table-panel">
          <div class="table-meta">
            <p><strong>{{ audit.value().length }}</strong> cambios cargados, ordenados del más reciente al más antiguo.</p>
            @if (activeFilters().resourceType || activeFilters().resourceId) {
              <p class="text-xs text-muted">
                Filtro activo:
                @if (activeFilters().resourceType) {
                  <span>{{ activeFilters().resourceType | label: resourceTypeLabel }}</span>
                } @else {
                  <span>todos los recursos</span>
                }
                @if (activeFilters().resourceId) {
                  <span> · {{ activeFilters().resourceId }}</span>
                }
              </p>
            }
          </div>

          <table class="table">
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Recurso</th>
                <th scope="col">Cambio</th>
                <th scope="col">Actor</th>
              </tr>
            </thead>
            <tbody>
              @for (entry of audit.value(); track entry.id) {
                <tr>
                  <td data-label="Fecha">
                    {{ entry.changedAt | when }}<br />
                    <span class="text-xs text-muted">{{ entry.changedAt | ago }}</span>
                  </td>
                  <td data-label="Recurso">
                    <div class="stack-sm">
                      <span class="text-xs text-muted">{{ entry.resourceType | label: resourceTypeLabel }}</span>
                      @if (resourceLink(entry); as link) {
                        <a [routerLink]="link" class="link mono resource-link">{{ entry.resourceId }}</a>
                      } @else {
                        <code class="mono">{{ entry.resourceId }}</code>
                      }
                    </div>
                  </td>
                  <td data-label="Cambio">
                    <div class="change">
                      @if (entry.previousStatus) {
                        <app-status [map]="statusMap(entry.resourceType)" [value]="entry.previousStatus" />
                      } @else {
                        <span class="text-xs text-muted">Estado inicial</span>
                      }
                      <app-icon name="arrow" [size]="16" />
                      <app-status [map]="statusMap(entry.resourceType)" [value]="entry.newStatus" />
                    </div>
                  </td>
                  <td data-label="Actor">
                    <div class="stack-sm">
                      <strong>{{ entry.changedByDisplayName }}</strong>
                      <span class="text-xs text-muted mono">{{ entry.changedBySubject }}</span>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </section>
      } @else {
        <app-empty title="No hay cambios para este filtro" text="Ajusta el tipo, el id o el límite y vuelve a consultar." />
      }
    </div>
  `,
  styles: `
    .filters-panel { display: grid; gap: var(--s-3); }
    .panel-note {
      display: flex;
      gap: var(--s-2);
      align-items: flex-start;
      padding: var(--s-3);
      border-radius: var(--radius-lg);
      background: var(--surface-2);
    }
    .panel-note p { margin: 0; }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: var(--s-2);
      align-items: flex-end;
    }
    .filters .grow { flex: 1 1 320px; }
    .filter-actions {
      display: flex;
      gap: var(--s-2);
      flex-wrap: wrap;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: var(--s-2);
      margin-bottom: var(--s-3);
    }
    .stat-card {
      display: grid;
      gap: var(--s-1);
      padding: var(--s-3);
    }
    .stat-card strong {
      font-size: 1.4rem;
      line-height: 1.1;
    }
    .table-panel { padding: var(--s-2) var(--s-4); }
    .table-meta {
      display: flex;
      justify-content: space-between;
      gap: var(--s-2);
      flex-wrap: wrap;
      margin-bottom: var(--s-2);
    }
    .table-meta p { margin: 0; }
    .change {
      display: flex;
      align-items: center;
      gap: var(--s-1);
      flex-wrap: wrap;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
      word-break: break-all;
    }
    .resource-link { display: inline-block; }
    @media (max-width: 720px) {
      .table-meta { flex-direction: column; }
      .filter-actions { width: 100%; }
    }
  `
})
export class AuditLogPage {
  private readonly api = inject(AdministrationApi);

  readonly resourceTypeLabel = AUDITED_RESOURCE_TYPE;
  readonly resourceTypes: readonly AuditedResourceType[] = ['REPAIR_REQUEST', 'REPAIR_PAYMENT', 'RENTAL_CONTRACT', 'JOB'];
  readonly limitOptions: readonly AuditFilters['limit'][] = [50, 100, 200, 500];
  readonly activeFilters = signal<AuditFilters>({ resourceType: '', resourceId: '', limit: 100 });
  readonly validationError = signal<string | null>(null);

  readonly audit = rxResource({
    params: () => this.activeFilters(),
    stream: ({ params }) =>
      this.api.statusChanges(params.resourceType || undefined, params.resourceId || undefined, params.limit)
  });

  readonly stats = computed(() => {
    const entries = this.audit.hasValue() ? this.audit.value() : [];
    return [
      { label: 'Registros', value: String(entries.length) },
      { label: 'Solicitudes', value: String(entries.filter((entry) => entry.resourceType === 'REPAIR_REQUEST').length) },
      { label: 'Pagos', value: String(entries.filter((entry) => entry.resourceType === 'REPAIR_PAYMENT').length) },
      { label: 'Contratos', value: String(entries.filter((entry) => entry.resourceType === 'RENTAL_CONTRACT').length) },
      { label: 'Trabajos', value: String(entries.filter((entry) => entry.resourceType === 'JOB').length) }
    ];
  });

  readonly loadError = computed(() => errorMessage(this.audit.error(), 'No pudimos cargar la bitácora de estados.'));

  form: AuditFilters = { resourceType: '', resourceId: '', limit: 100 };

  applyFilters(): void {
    const resourceId = this.form.resourceId.trim();
    if (resourceId && !this.form.resourceType) {
      this.validationError.set('Para filtrar por id, primero elige el tipo de recurso.');
      return;
    }
    this.validationError.set(null);
    this.activeFilters.set({
      resourceType: this.form.resourceType,
      resourceId,
      limit: this.form.limit
    });
  }

  resetFilters(): void {
    this.form = { resourceType: '', resourceId: '', limit: 100 };
    this.validationError.set(null);
    this.activeFilters.set(this.form);
  }

  statusMap(resourceType: AuditedResourceType): Record<string, Label> {
    return AUDIT_STATUS_BY_RESOURCE[resourceType] ?? this.fallbackStatusMap(resourceType);
  }

  resourceLink(entry: StatusChangeEntry): string[] | null {
    switch (entry.resourceType) {
      case 'REPAIR_REQUEST':
        return ['/requests', entry.resourceId];
      case 'RENTAL_CONTRACT':
        return ['/contracts', entry.resourceId];
      case 'JOB':
        return ['/jobs', entry.resourceId];
      default:
        return null;
    }
  }

  private fallbackStatusMap(resourceType: AuditedResourceType): Record<string, Label> {
    switch (resourceType) {
      case 'REPAIR_REQUEST':
        return REQUEST_STATUS;
      case 'REPAIR_PAYMENT':
        return PAYMENT_STATUS;
      case 'RENTAL_CONTRACT':
        return CONTRACT_STATUS;
      case 'JOB':
        return JOB_STATUS;
    }
  }
}
