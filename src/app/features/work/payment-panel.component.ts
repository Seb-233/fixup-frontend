import { ChangeDetectionStrategy, Component, input, output, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PaymentDetail, PaymentSimulationOutcome } from '../../data/models';
import { WorkApi } from '../../data/work.api';
import { PAYMENT_METHOD, PAYMENT_PURPOSE, PAYMENT_STATUS, errorMessage } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { LabelPipe, MoneyPipe, WhenPipe } from '../../shared/ui/pipes';
import { StatusComponent } from '../../shared/ui/status.component';

// Pago por transferencia en la pasarela simulada (FR-UC-05). No se piden datos de tarjeta ni de cuenta:
// quien paga elige el resultado que la pasarela de prueba debe devolver.
@Component({
  selector: 'app-payment-panel',
  imports: [FormsModule, IconComponent, StatusComponent, MoneyPipe, WhenPipe, LabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel stack" aria-labelledby="pay-title">
      <div class="spread">
        <h2 id="pay-title" class="text-lg">Pago</h2>
        <app-status [map]="status" [value]="payment().status" />
      </div>
      <dl class="facts">
        <div><dt>Valor</dt><dd class="price">{{ payment().amount | money }}</dd></div>
        <div><dt>Método</dt><dd>{{ payment().paymentMethod | label: methods }}</dd></div>
        <div class="wide"><dt>Concepto</dt><dd>{{ payment().purpose | label: purposes }}</dd></div>
      </dl>

      @switch (payment().status) {
        @case ('APPROVED') {
          <p class="text-sm">
            Pagado el {{ payment().completedAt | when }};
            {{ payment().purpose === 'SERVICE' ? 'el trabajo ya quedó abierto para el técnico.' : 'la deuda quedó saldada.' }}
          </p>
        }
        @case ('PENDING') {
          <p class="text-sm">
            {{ payment().purpose === 'SERVICE' ? 'El trabajo se abre en cuanto este pago quede aprobado.' : 'Mientras el saldo siga pendiente no puedes abrir otra solicitud.' }}
          </p>
        }
        @default {
          <div class="alert alert-danger" role="status">El último intento no se aprobó. Puedes intentarlo de nuevo.</div>
        }
      }

      @if (canPay() && payment().status !== 'APPROVED') {
        @if (!open()) {
          <button type="button" class="btn btn-primary" (click)="open.set(true)"><app-icon name="card" />Pagar {{ payment().amount | money }}</button>
        } @else {
          <form class="stack" (ngSubmit)="pay()">
            <div class="field">
              <label for="outcome">Resultado simulado</label>
              <select id="outcome" class="select" name="outcome" [(ngModel)]="outcome">
                <option value="APPROVED">Aprobar la transferencia</option>
                <option value="DECLINED">Rechazarla</option>
                <option value="PENDING">Dejarla pendiente</option>
                <option value="ERROR">Simular un error de la pasarela</option>
              </select>
              <span class="hint">Modo de prueba: no se mueve dinero ni se piden datos bancarios.</span>
            </div>
            @if (error()) { <div class="alert alert-danger" role="alert">{{ error() }}</div> }
            <div class="cluster">
              <button type="submit" class="btn btn-primary" [disabled]="busy()">{{ busy() ? 'Procesando…' : 'Confirmar pago' }}</button>
              <button type="button" class="btn btn-ghost" (click)="open.set(false)">Volver</button>
            </div>
          </form>
        }
      }
    </section>
  `,
  styles: `.wide { grid-column: 1 / -1; }`
})
export class PaymentPanelComponent {
  private readonly api = inject(WorkApi);

  readonly payment = input.required<PaymentDetail>();
  readonly canPay = input(false);
  readonly paid = output<PaymentDetail>();

  readonly status = PAYMENT_STATUS;
  readonly methods = PAYMENT_METHOD;
  readonly purposes = PAYMENT_PURPOSE;
  readonly open = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  outcome: PaymentSimulationOutcome = 'APPROVED';

  pay(): void {
    this.busy.set(true);
    this.error.set(null);
    this.api.simulate(this.payment().paymentId, this.outcome).subscribe({
      next: (updated) => {
        this.busy.set(false);
        this.open.set(updated.status !== 'APPROVED');
        this.paid.emit(updated);
      },
      error: (failure) => {
        this.busy.set(false);
        this.error.set(errorMessage(failure, 'No pudimos procesar el pago.'));
      }
    });
  }
}
