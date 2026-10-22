import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { PaymentDetail } from '../../data/models';
import { WorkApi } from '../../data/work.api';
import { IconComponent } from '../../shared/ui/icon.component';
import { ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { PaymentPanelComponent } from './payment-panel.component';

// FR-UC-05: la pasarela simulada de un pago por transferencia. Aquí llega quien acepta una cotización
// con transferencia o paga el saldo de un trabajo en efectivo, y desde Pagos para retomar un intento.
@Component({
  selector: 'app-checkout-page',
  imports: [RouterLink, IconComponent, PaymentPanelComponent, LoadingComponent, ErrorStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <header class="page-header">
        <div>
          <h1>Pasarela de pago</h1>
          <p class="lede">Simulación académica: no se mueve dinero ni se piden datos bancarios. Elige el resultado que debe devolver la pasarela.</p>
        </div>
        <div class="actions">
          <a routerLink="/payments" class="btn btn-ghost"><app-icon name="chevron-left" />Mis pagos</a>
        </div>
      </header>

      @if (payment.isLoading() && !payment.hasValue()) {
        <app-loading text="Cargando el pago…" />
      } @else if (payment.error()) {
        <app-error (retry)="payment.reload()" />
      } @else if (payment.hasValue()) {
        <app-payment-panel [payment]="payment.value()" [canPay]="true" (paid)="payment.set($event)" />
        <p class="text-sm">
          <a [routerLink]="['/requests', payment.value().requestId]" class="link">Ver la solicitud</a>
          @if (payment.value().status === 'APPROVED' && payment.value().purpose === 'SERVICE') {
            · el técnico ya tiene el trabajo en su agenda.
          }
        </p>
      }
    </div>
  `
})
export class CheckoutPage {
  private readonly api = inject(WorkApi);

  readonly paymentId = input.required<string>();
  readonly payment = rxResource<PaymentDetail, string>({
    params: () => this.paymentId(),
    stream: ({ params }) => this.api.payment(params)
  });
}
