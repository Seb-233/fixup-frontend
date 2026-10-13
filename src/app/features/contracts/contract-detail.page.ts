import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { ProjectsApi } from '../../data/projects.api';
import { CONTRACT_STATUS, errorMessage } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { DayPipe, MoneyPipe } from '../../shared/ui/pipes';
import { ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { StatusComponent } from '../../shared/ui/status.component';
import { daysUntil } from './contracts.page';

@Component({
  selector: 'app-contract-detail-page',
  imports: [FormsModule, RouterLink, IconComponent, StatusComponent, MoneyPipe, DayPipe, LoadingComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <a routerLink="/contracts" class="back-link"><app-icon name="chevron-left" [size]="16" />Contratos</a>
      @if (contract.isLoading() && !contract.hasValue()) {
        <app-loading text="Cargando el contrato…" />
      } @else if (contract.error()) {
        <app-error title="No pudimos abrir el contrato" (retry)="contract.reload()" />
      } @else if (contract.hasValue()) {
        @let c = contract.value();
        <header class="page-header">
          <div>
            <app-status [map]="status" [value]="c.status" />
            <h1 class="title">{{ c.propertyName || 'Contrato de arriendo' }}</h1>
            <p class="lede">{{ c.propertyAddress }}{{ c.propertyCity ? ', ' + c.propertyCity : '' }}</p>
          </div>
          @if (canManage() && open()) {
            <div class="actions"><a [routerLink]="['/contracts', c.id, 'edit']" class="btn btn-secondary"><app-icon name="edit" />Editar</a></div>
          }
        </header>

        @if (remaining(); as days) {
          @if (days <= 60 && open()) {
            <div class="alert alert-warning" role="status">Vence en {{ days }} {{ days === 1 ? 'día' : 'días' }}, el {{ c.endDate | day }}.</div>
          }
        }
        @if (message()) { <div class="alert" [class.alert-success]="!messageIsError()" [class.alert-danger]="messageIsError()" role="status">{{ message() }}</div> }

        <section class="panel">
          <dl class="facts">
            <div><dt>Arrendador</dt><dd>{{ c.ownerName || '—' }}</dd></div>
            <div><dt>Arrendatario</dt><dd>{{ c.tenantName || '—' }}</dd></div>
            <div><dt>Inicio</dt><dd>{{ c.startDate | day }}</dd></div>
            <div><dt>Fin</dt><dd>{{ c.endDate | day }}</dd></div>
            <div><dt>Canon mensual</dt><dd>{{ c.monthlyRentAmount | money }}</dd></div>
            <div><dt>Depósito</dt><dd>{{ c.depositAmount ? (c.depositAmount | money) : '—' }}</dd></div>
            <div><dt>Día de pago</dt><dd>{{ c.paymentDayOfMonth ? 'Día ' + c.paymentDayOfMonth : '—' }}</dd></div>
            <div><dt>Aviso de renovación</dt><dd>{{ c.renewalNoticeDays ? c.renewalNoticeDays + ' días antes' : '—' }}</dd></div>
          </dl>
          @if (c.notes) { <p class="notes text-sm">{{ c.notes }}</p> }
        </section>

        @if (isTenant() && open()) {
          <div class="panel panel-quiet spread">
            <span class="text-sm">¿Algo se dañó en el inmueble?</span>
            <a routerLink="/requests/new" class="btn btn-primary">Reportar un daño</a>
          </div>
        }

        @if (canManage() && open()) {
          <div class="grid-2">
            <form class="panel stack" (ngSubmit)="renew()">
              <h2 class="text-lg">Renovar</h2>
              <div class="field">
                <label for="renew-end">Nueva fecha de fin</label>
                <input id="renew-end" type="date" class="input" name="renewEnd" [(ngModel)]="newEndDate" [min]="c.endDate" required />
              </div>
              <div><button type="submit" class="btn btn-secondary" [disabled]="busy() || !newEndDate">Renovar contrato</button></div>
            </form>
            <form class="panel stack" (ngSubmit)="terminate()">
              <h2 class="text-lg">Terminar</h2>
              <div class="field">
                <label for="reason">Motivo</label>
                <input id="reason" class="input" name="reason" maxlength="300" [(ngModel)]="reason" placeholder="Acuerdo entre las partes" />
              </div>
              <div><button type="submit" class="btn btn-danger" [disabled]="busy() || !reason.trim()">Terminar contrato</button></div>
            </form>
          </div>
        }
      }
    </div>
  `,
  styles: `.title { margin-top: var(--s-2); } .notes { margin-top: var(--s-4); white-space: pre-line; color: var(--text-muted); }`
})
export class ContractDetailPage {
  private readonly api = inject(ProjectsApi);
  private readonly user = inject(CurrentUserStore);
  readonly contractId = input.required<string>();
  readonly contract = rxResource({ params: () => this.contractId(), stream: ({ params }) => this.api.contract(params) });
  readonly status = CONTRACT_STATUS;
  readonly isTenant = computed(() => this.user.activeRole() === 'TENANT');
  readonly canManage = computed(() => !this.isTenant());
  readonly open = computed(() => this.contract.hasValue() && ['ACTIVE', 'RENEWED', 'DRAFT'].includes(this.contract.value().status ?? ''));
  readonly remaining = computed(() => (this.contract.hasValue() ? daysUntil(this.contract.value().endDate) : null));
  newEndDate = '';
  reason = '';
  readonly busy = signal(false);
  readonly message = signal<string | null>(null);
  readonly messageIsError = signal(false);

  renew(): void {
    this.act(this.api.renewContract(this.contractId(), this.newEndDate), 'Contrato renovado.');
  }

  terminate(): void {
    if (typeof window !== 'undefined' && !window.confirm('¿Terminar este contrato? El arrendatario dejará de poder reportar daños del inmueble.')) return;
    this.act(this.api.terminateContract(this.contractId(), this.reason.trim()), 'Contrato terminado.');
  }

  private act(call: ReturnType<ProjectsApi['renewContract']>, success: string): void {
    this.busy.set(true);
    this.message.set(null);
    call.subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.contract.set(updated);
        this.messageIsError.set(false);
        this.message.set(success);
      },
      error: (failure) => {
        this.busy.set(false);
        this.messageIsError.set(true);
        this.message.set(errorMessage(failure, 'No pudimos actualizar el contrato.'));
      }
    });
  }
}
