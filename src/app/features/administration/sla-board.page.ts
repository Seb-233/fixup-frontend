import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { of } from 'rxjs';
import { PeopleApi } from '../../data/people.api';
import { SlaBoardItemResponse } from '../../data/models';
import { REQUEST_STATUS, SLA_STATE, SPECIALTY, URGENCY, errorMessage } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { AgoPipe, LabelPipe, WhenPipe } from '../../shared/ui/pipes';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { StatusComponent } from '../../shared/ui/status.component';

type Filter = 'BREACHED' | 'WARNING' | 'ALL';

@Component({
  selector: 'app-sla-board-page',
  imports: [FormsModule, RouterLink, IconComponent, StatusComponent, LabelPipe, WhenPipe, AgoPipe, LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>Plazos de atención</h1>
          <p class="lede">Solicitudes con el plazo por vencer o ya vencido, de la que vence primero a la última. Reconoce la escalada o reasigna el técnico.</p>
        </div>
        <div class="actions"><button type="button" class="btn btn-ghost" (click)="board.reload()"><app-icon name="refresh" />Actualizar</button></div>
      </header>

      @if (board.isLoading() && !board.hasValue()) {
        <app-loading text="Cargando plazos…" />
      } @else if (board.error()) {
        <app-error (retry)="board.reload()" />
      } @else if (board.hasValue() && board.value().content.length) {
        <div class="tabs" role="tablist">
          @for (tab of tabs; track tab.key) {
            <button type="button" role="tab" [attr.aria-selected]="filter() === tab.key" (click)="filter.set(tab.key)">{{ tab.label }} <span class="count">{{ count(tab.key) }}</span></button>
          }
        </div>
        @if (message()) { <div class="alert" [class.alert-danger]="messageIsError()" [class.alert-success]="!messageIsError()" role="status">{{ message() }}</div> }
        <div class="panel table-panel">
          <table class="table">
            <thead><tr><th scope="col">Solicitud</th><th scope="col">Urgencia</th><th scope="col">Vence</th><th scope="col">Plazo</th><th scope="col"><span class="visually-hidden">Acciones</span></th></tr></thead>
            <tbody>
              @for (item of visible(); track item.requestId) {
                <tr>
                  <td data-label="Solicitud">
                    <div class="stack-sm">
                      <a [routerLink]="['/requests', item.requestId]" class="link">{{ item.title || 'Solicitud' }}</a>
                      <span class="text-xs text-muted">{{ item.specialty | label: specialty }} · {{ item.propertyCity }} · <app-status [map]="status" [value]="item.status" /></span>
                    </div>
                  </td>
                  <td data-label="Urgencia"><app-status [map]="urgency" [value]="item.urgencyLevel" /></td>
                  <td data-label="Vence">{{ item.slaDeadline | when }}<br /><span class="text-xs text-muted">{{ item.slaDeadline | ago }}</span></td>
                  <td data-label="Plazo"><app-status [map]="sla" [value]="item.slaState" /></td>
                  <td data-label="Acciones">
                    <div class="row-actions">
                      <button type="button" class="btn btn-ghost" (click)="acknowledge(item)" [disabled]="busy() === item.requestId">Reconocer</button>
                      @if (item.assignedFixerUserId) {
                        <button type="button" class="btn btn-secondary" (click)="startReassign(item)">Reasignar</button>
                      }
                    </div>
                  </td>
                </tr>
                @if (reassigning() === item.requestId) {
                  <tr class="reassign-row">
                    <td colspan="5">
                      <form class="reassign" (ngSubmit)="reassign(item)">
                        <div class="field grow">
                          <label [for]="'fixer-' + item.requestId">Nuevo técnico ({{ item.specialty | label: specialty }}, {{ item.propertyCity }})</label>
                          <select [id]="'fixer-' + item.requestId" class="select" name="fixer" [(ngModel)]="newFixerId" required>
                            <option value="" disabled>Elige un técnico verificado</option>
                            @if (candidates.hasValue()) {
                              @for (f of candidates.value(); track f.fixerUserId) {
                                @if (f.fixerUserId !== item.assignedFixerUserId) { <option [value]="f.fixerUserId">{{ f.displayName }}{{ f.city ? ' · ' + f.city : '' }}</option> }
                              }
                            }
                          </select>
                        </div>
                        <button type="submit" class="btn btn-primary" [disabled]="!newFixerId || busy() === item.requestId">Reasignar</button>
                        <button type="button" class="btn btn-ghost" (click)="reassigning.set(null)">Cancelar</button>
                      </form>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
          @if (!visible().length) { <p class="text-muted empty-filter">Nada en este estado.</p> }
        </div>
      } @else {
        <app-empty title="Ningún plazo en riesgo" text="Aquí aparecen las solicitudes cuando su plazo de atención está por vencer o ya venció." />
      }
    </div>
  `,
  styles: `
    .table-panel { padding: var(--s-2) var(--s-4); }
    .row-actions { display: flex; flex-wrap: wrap; gap: var(--s-1); justify-content: flex-end; }
    .reassign { display: flex; flex-wrap: wrap; gap: var(--s-2); align-items: flex-end; }
    .reassign .grow { flex: 1 1 260px; }
    .reassign-row td { background: var(--surface-2); }
    .empty-filter { padding: var(--s-4) 0; }
  `
})
export class SlaBoardPage {
  private readonly api = inject(PeopleApi);
  readonly board = rxResource({ stream: () => this.api.slaBoard(0, 100) });
  readonly filter = signal<Filter>('BREACHED');
  readonly status = REQUEST_STATUS;
  readonly sla = SLA_STATE;
  readonly urgency = URGENCY;
  readonly specialty = SPECIALTY;
  readonly tabs: { key: Filter; label: string }[] = [
    { key: 'BREACHED', label: 'Vencidas' },
    { key: 'WARNING', label: 'Por vencer' },
    { key: 'ALL', label: 'Todas' }
  ];
  readonly busy = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  readonly messageIsError = signal(false);
  readonly reassigning = signal<string | null>(null);
  private readonly reassignTarget = signal<SlaBoardItemResponse | null>(null);
  newFixerId = '';
  readonly candidates = rxResource({
    params: () => this.reassignTarget() ?? undefined,
    stream: ({ params }) => (params.specialty ? this.api.directory(params.specialty, params.propertyCity) : of([]))
  });

  readonly visible = computed(() =>
    this.board.hasValue() ? this.board.value().content.filter((item) => this.filter() === 'ALL' || item.slaState === this.filter()) : []
  );

  count(filter: Filter): number {
    return this.board.hasValue() ? this.board.value().content.filter((item) => filter === 'ALL' || item.slaState === filter).length : 0;
  }

  acknowledge(item: SlaBoardItemResponse): void {
    this.run(item.requestId, this.api.acknowledge(item.requestId), 'Escalada reconocida.');
  }

  startReassign(item: SlaBoardItemResponse): void {
    this.newFixerId = '';
    this.reassignTarget.set(item);
    this.reassigning.set(item.requestId);
  }

  reassign(item: SlaBoardItemResponse): void {
    this.run(item.requestId, this.api.reassign(item.requestId, this.newFixerId), 'Técnico reasignado.');
  }

  private run(requestId: string, call: ReturnType<PeopleApi['acknowledge']> | ReturnType<PeopleApi['reassign']>, success: string): void {
    this.busy.set(requestId);
    (call as ReturnType<PeopleApi['acknowledge']>).subscribe({
      next: () => {
        this.busy.set(null);
        this.reassigning.set(null);
        this.messageIsError.set(false);
        this.message.set(success);
        this.board.reload();
      },
      error: (failure) => {
        this.busy.set(null);
        this.messageIsError.set(true);
        this.message.set(errorMessage(failure, 'No pudimos completar la acción.'));
      }
    });
  }
}
