import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { KnownPaymentsService } from '../../data/known-payments';
import { PaymentDetail } from '../../data/models';
import { WorkApi } from '../../data/work.api';
import { ROLE_NAME } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { PaymentPanelComponent } from './payment-panel.component';

// FR-UC-05.4: pasarela simulada 100 % digital de FixUp.
// Permite pagar exclusivamente al propietario o administrador inmobiliario vigente.
@Component({
  selector: 'app-checkout-page',
  imports: [RouterLink, IconComponent, PaymentPanelComponent, LoadingComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <header class="page-header">
        <div>
          <h1>Pasarela de pago digital</h1>
          <p class="lede">Simulación académica: no se mueve dinero ni se piden datos bancarios reales. Selecciona tu instrumento simulado (Tarjeta, PSE o Nequi).</p>
        </div>
        <div class="actions">
          @if (payment.hasValue() && payment.value().requestId) {
            <a [routerLink]="['/requests', payment.value().requestId]" class="btn btn-ghost">
              <app-icon name="chevron-left" />Volver a la solicitud
            </a>
          }
          <a routerLink="/payments" class="btn btn-ghost"><app-icon name="chevron-left" />Mis pagos</a>
        </div>
      </header>

      @if (!canPay()) {
        <div class="alert alert-warning" role="alert">
          <app-icon name="alert-triangle" />
          <span>Tu rol actual ({{ roleLabel() }}) no tiene autorización para pagar este servicio. Solo el propietario del inmueble o su administrador inmobiliario vigente pueden realizar el pago.</span>
        </div>
      }

      @if (payment.isLoading() && !payment.hasValue()) {
        <app-loading text="Cargando información del pago digital…" />
      } @else if (payment.error()) {
        <app-error (retry)="payment.reload()" />
      } @else if (payment.hasValue()) {
        <app-payment-panel [payment]="payment.value()" [canPay]="canPay()" (paid)="payment.set($event)" />
        <p class="text-sm">
          @if (payment.value().requestId) {
            <a [routerLink]="['/requests', payment.value().requestId]" class="link">Ver la solicitud</a>
          }
          @if (payment.value().status === 'APPROVED' && payment.value().purpose === 'SERVICE') {
            · el técnico ya tiene el trabajo disponible en Mis trabajos.
          }
        </p>
      }
    </div>
  `
})
export class CheckoutPage {
  private readonly api = inject(WorkApi);
  private readonly userStore = inject(CurrentUserStore);
  private readonly knownPayments = inject(KnownPaymentsService);

  readonly paymentId = input.required<string>();

  readonly canPay = computed(() => {
    const role = this.userStore.activeRole();
    return role === 'OWNER' || role === 'REAL_ESTATE_MANAGER';
  });

  readonly roleLabel = computed(() => {
    const role = this.userStore.activeRole();
    return role ? ROLE_NAME[role] ?? role : 'Invitado';
  });

  readonly payment = rxResource<PaymentDetail, string>({
    params: () => this.paymentId(),
    stream: ({ params }) => this.api.payment(params)
  });

  constructor() {
    effect(() => {
      if (this.payment.hasValue()) {
        const p = this.payment.value();
        this.knownPayments.register({
          paymentId: p.paymentId,
          requestId: p.requestId,
          amount: p.amount,
          reference: p.reference,
          status: p.status
        });
      }
    });
  }
}
