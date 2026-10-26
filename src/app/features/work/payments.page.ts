import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { KnownPaymentsService } from '../../data/known-payments';
import { OwnerDebtDetail, PaymentDetail, PaymentPageResponse, PaymentStatus } from '../../data/models';
import { WorkApi } from '../../data/work.api';
import { PAYMENT_PURPOSE, PAYMENT_STATUS, errorMessage, money } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { DayPipe, MoneyPipe } from '../../shared/ui/pipes';
import { EmptyStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { StatusComponent } from '../../shared/ui/status.component';
import { PaymentPanelComponent } from './payment-panel.component';

// FR-UC-05.4 / INTEGRATION-04: pagos digitales y saldos de trabajos en FixUp.
// La pantalla consulta authoritativamente el backend mediante GET /payments/me con paginación
// y filtros de estado, utilizando KnownPaymentsService como almacenamiento auxiliar local.
@Component({
  selector: 'app-payments-page',
  imports: [
    FormsModule,
    RouterLink,
    IconComponent,
    StatusComponent,
    MoneyPipe,
    DayPipe,
    PaymentPanelComponent,
    LoadingComponent,
    EmptyStateComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <h1>Pagos</h1>
          <p class="lede">
            Registro autoritativo de pagos digitales en pasarela simulada. El técnico inicia el trabajo una vez el pago es aprobado.
          </p>
        </div>
        <div class="actions">
          <a routerLink="/expenses" class="btn btn-secondary"><app-icon name="chart" />Reporte de gastos</a>
        </div>
      </header>

      @if (outstanding().length) {
        <section class="panel stack" aria-labelledby="debts-title">
          <div class="spread">
            <h2 id="debts-title" class="text-lg">Saldos pendientes de trabajos en efectivo históricos</h2>
            <span class="price">{{ debtTotal() }}</span>
          </div>
          <p class="text-sm">Mientras tengas un saldo pendiente no puedes abrir otra solicitud.</p>
          <ul class="stack-sm" role="list">
            @for (d of outstanding(); track d.debtId) {
              <li class="spread">
                <span>
                  <a [routerLink]="['/requests', d.requestId]" class="link">Trabajo del {{ d.createdAt | day }}</a>
                  · {{ d.amount | money }}
                </span>
                <button type="button" class="btn btn-primary" [disabled]="paying() === d.debtId" (click)="payDebt(d)">
                  {{ paying() === d.debtId ? 'Preparando…' : 'Pagar saldo' }}
                </button>
              </li>
            }
          </ul>
          @if (debtError()) { <div class="alert alert-danger" role="alert">{{ debtError() }}</div> }
        </section>
      }

      <div class="alert alert-info text-sm" role="status">
        <app-icon name="info" />
        <div>
          <strong>Consulta autoritativa:</strong> Listado recuperado directamente desde el backend oficial (<code>GET /payments/me</code>), con aislamiento por usuario, roles y paginación en tiempo real.
        </div>
      </div>

      <!-- Barra de filtros y paginación -->
      <div class="panel toolbar spread wrap">
        <div class="cluster">
          <label for="status-filter" class="text-sm font-medium">Estado:</label>
          <select id="status-filter" class="select" [ngModel]="statusFilter()" (ngModelChange)="setStatusFilter($event)">
            <option value="">Todos los estados</option>
            <option value="PENDING">Pendientes</option>
            <option value="APPROVED">Aprobados</option>
            <option value="DECLINED">Rechazados</option>
            <option value="ERROR">Con error</option>
          </select>
        </div>

        <div class="cluster text-sm">
          <button type="button" class="btn btn-ghost" [disabled]="page() === 0 || paymentsResource.isLoading()" (click)="prevPage()">
            <app-icon name="chevron-left" />Anterior
          </button>
          <span>Página {{ page() + 1 }}</span>
          <button type="button" class="btn btn-ghost" [disabled]="!hasMore() || paymentsResource.isLoading()" (click)="nextPage()">
            Siguiente<app-icon name="chevron-right" />
          </button>
        </div>
      </div>

      @if (fetchError()) {
        <div class="alert alert-danger" role="alert">
          <app-icon name="alert-triangle" />
          <span>{{ fetchError() }}</span>
        </div>
      }

      @if (paymentsResource.isLoading()) {
        <app-loading text="Consultando pagos en el backend…" />
      } @else if (items().length) {
        <dl class="facts panel">
          <div><dt>Pagos en esta página</dt><dd>{{ items().length }}</dd></div>
          <div><dt>Pendientes</dt><dd>{{ pendingCount() }}</dd></div>
          <div><dt>Aprobados</dt><dd>{{ approvedCount() }}</dd></div>
        </dl>

        <div class="split">
          <div class="panel table-panel">
            <table class="table">
              <thead>
                <tr>
                  <th scope="col">Referencia / ID</th>
                  <th scope="col">Fecha</th>
                  <th scope="col" class="num">Valor</th>
                  <th scope="col">Estado</th>
                  <th scope="col"><span class="visually-hidden">Acción</span></th>
                </tr>
              </thead>
              <tbody>
                @for (p of items(); track p.paymentId) {
                  <tr [class.selected]="selectedPaymentId() === p.paymentId">
                    <td data-label="Referencia">
                      <div>
                        <strong>{{ p.reference || ('FIX-' + p.paymentId.slice(0, 8)) }}</strong>
                        @if (p.context?.concept) {
                          <div class="text-xs text-muted">{{ p.context?.concept }}</div>
                        }
                        @if (p.requestId) {
                          <div class="text-xs">
                            <a [routerLink]="['/requests', p.requestId]" class="link">Ver solicitud</a>
                          </div>
                        }
                      </div>
                    </td>
                    <td data-label="Fecha">{{ p.createdAt | day }}</td>
                    <td data-label="Valor" class="num">{{ p.amount | money }}</td>
                    <td data-label="Estado"><app-status [map]="status" [value]="p.status" /></td>
                    <td data-label="Acción">
                      <button type="button" class="btn btn-secondary" (click)="selectPayment(p.paymentId)">
                        {{ p.status === 'APPROVED' ? 'Ver detalle' : 'Pagar' }}
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <aside class="sticky-aside">
            @if (loadingSelected()) {
              <app-loading text="Consultando detalle del pago…" />
            } @else if (selectedDetail()) {
              <app-payment-panel
                [payment]="selectedDetail()!"
                [canPay]="canPay()"
                (paid)="onPaid($event)"
              />
            } @else {
              <div class="panel panel-quiet stack-sm">
                <h2 class="text-lg">Detalle del pago</h2>
                <p class="text-sm">Selecciona un pago para consultar su estado en la pasarela o completar el intento de pago.</p>
              </div>
            }
          </aside>
        </div>
      } @else {
        <app-empty
          title="No hay pagos registrados"
          text="Cuando aceptes una cotización o pagues un saldo pendiente, los registros aparecerán aquí automáticamente."
        />
      }
    </div>
  `,
  styles: `
    .table-panel { padding: var(--s-2) var(--s-4); }
    tr.selected td { background: var(--surface-2); }
    .toolbar { padding: var(--s-3) var(--s-4); }
  `
})
export class PaymentsPage {
  private readonly api = inject(WorkApi);
  private readonly router = inject(Router);
  private readonly knownPayments = inject(KnownPaymentsService);
  private readonly userStore = inject(CurrentUserStore);

  readonly debts = rxResource({
    stream: () => this.api.myDebts().pipe(catchError(() => of<OwnerDebtDetail[]>([])))
  });

  readonly page = signal<number>(0);
  readonly pageSize = signal<number>(10);
  readonly statusFilter = signal<string>('');
  readonly fetchError = signal<string | null>(null);

  readonly paymentsResource = rxResource({
    params: () => ({
      userId: this.userStore.user()?.id,
      role: this.userStore.activeRole(),
      page: this.page(),
      size: this.pageSize(),
      status: this.statusFilter()
    }),
    stream: ({ params }) => {
      this.fetchError.set(null);
      if (!params.userId) {
        return of<PaymentPageResponse>({ items: [], page: 0, size: params.size, hasMore: false });
      }
      return this.api
        .myPayments({
          page: params.page,
          size: params.size,
          status: (params.status || undefined) as PaymentStatus | undefined
        })
        .pipe(
          map((pageRes) => {
            for (const p of pageRes.items) {
              this.knownPayments.register({
                paymentId: p.paymentId,
                requestId: p.requestId,
                amount: p.amount,
                reference: p.reference,
                status: p.status
              });
            }
            return pageRes;
          }),
          catchError((err) => {
            if (err.status === 401) {
              this.fetchError.set('Sesión no válida o expirada. Inicia sesión nuevamente.');
            } else if (err.status === 403) {
              this.fetchError.set('Acceso denegado: solo propietarios y administradores pueden consultar pagos.');
            } else {
              this.fetchError.set(errorMessage(err, 'No fue posible consultar los pagos en el servidor.'));
            }
            return of<PaymentPageResponse>({ items: [], page: 0, size: params.size, hasMore: false });
          })
        );
    }
  });

  readonly items = computed<PaymentDetail[]>(() => this.paymentsResource.value()?.items ?? []);
  readonly hasMore = computed<boolean>(() => this.paymentsResource.value()?.hasMore ?? false);

  readonly selectedPaymentId = signal<string | null>(null);
  readonly selectedDetail = signal<PaymentDetail | null>(null);
  readonly loadingSelected = signal<boolean>(false);
  readonly paying = signal<string | null>(null);
  readonly debtError = signal<string | null>(null);

  readonly status = PAYMENT_STATUS;
  readonly purposes = PAYMENT_PURPOSE;

  readonly canPay = computed(() => {
    const role = this.userStore.activeRole();
    return role === 'OWNER' || role === 'REAL_ESTATE_MANAGER';
  });

  readonly outstanding = computed(() =>
    this.debts.hasValue() ? this.debts.value().filter((d) => d.status === 'OUTSTANDING') : []
  );

  readonly debtTotal = computed(() =>
    money(this.outstanding().reduce((total, d) => total + (d.amount ?? 0), 0))
  );

  readonly pendingCount = computed(
    () => this.items().filter((p) => p.status !== 'APPROVED').length
  );

  readonly approvedCount = computed(
    () => this.items().filter((p) => p.status === 'APPROVED').length
  );

  setStatusFilter(status: string): void {
    this.statusFilter.set(status);
    this.page.set(0);
  }

  nextPage(): void {
    if (this.hasMore()) {
      this.page.update((p) => p + 1);
    }
  }

  prevPage(): void {
    if (this.page() > 0) {
      this.page.update((p) => p - 1);
    }
  }

  selectPayment(paymentId: string): void {
    this.selectedPaymentId.set(paymentId);
    this.loadingSelected.set(true);
    this.api.payment(paymentId).subscribe({
      next: (detail) => {
        this.selectedDetail.set(detail);
        this.loadingSelected.set(false);
        this.knownPayments.updateStatus(paymentId, detail.status);
      },
      error: () => {
        this.loadingSelected.set(false);
      }
    });
  }

  onPaid(fresh: PaymentDetail): void {
    this.selectedDetail.set(fresh);
    this.knownPayments.updateStatus(fresh.paymentId, fresh.status);
    this.paymentsResource.reload();
  }

  payDebt(debt: OwnerDebtDetail): void {
    if (!debt.debtId || this.paying()) return;
    this.paying.set(debt.debtId);
    this.debtError.set(null);
    this.api.payDebt(debt.debtId).subscribe({
      next: (payment) => {
        this.paying.set(null);
        this.knownPayments.register({
          paymentId: payment.paymentId,
          requestId: payment.requestId,
          amount: payment.amount,
          reference: payment.reference,
          status: payment.status
        });
        void this.router.navigate(['/payments', payment.paymentId]);
      },
      error: (failure) => {
        this.paying.set(null);
        this.debtError.set(errorMessage(failure, 'No pudimos preparar el pago del saldo.'));
      }
    });
  }
}
