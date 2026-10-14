import { ChangeDetectionStrategy, Component, input, output, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Charge, PaymentMethod } from '../../data/models';
import { WorkApi } from '../../data/work.api';
import { CHARGE_STATUS, PAYMENT_METHOD, errorMessage } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { LabelPipe, MoneyPipe, WhenPipe } from '../../shared/ui/pipes';
import { StatusComponent } from '../../shared/ui/status.component';

// Pago de un trabajo en la pasarela de prueba (FR-UC-22). No se piden datos de tarjeta, cuenta ni
// celular: el backend solo recibe referencia, valor, medio y el resultado simulado que se quiere ver.
@Component({
  selector: 'app-payment-panel',
  imports: [FormsModule, IconComponent, StatusComponent, MoneyPipe, WhenPipe, LabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel stack" aria-labelledby="pay-title">
      <div class="spread">
        <h2 id="pay-title" class="text-lg">Pago</h2>
        <app-status [map]="status" [value]="charge().status" />
      </div>
      <dl class="facts">
        <div><dt>Valor</dt><dd class="price">{{ charge().amount | money }}</dd></div>
        <div><dt>Referencia</dt><dd>{{ charge().reference }}</dd></div>
        @if (charge().concept) { <div class="wide"><dt>Concepto</dt><dd>{{ charge().concept }}</dd></div> }
      </dl>

      @switch (charge().status) {
        @case ('APPROVED') {
          <p class="text-sm">
            Pagado el {{ charge().approvedAt | when }} con {{ charge().method | label: methods }}. Transacción {{ charge().gatewayTransactionId }}.
          </p>
        }
        @case ('DECLINED') {
          <div class="alert alert-danger" role="status">
            Último intento rechazado: {{ charge().failureReason || 'la pasarela no aprobó el pago' }}. Puedes intentarlo de nuevo.
          </div>
        }
      }

      @if (canPay() && charge().status !== 'APPROVED') {
        @if (!open()) {
          <button type="button" class="btn btn-primary" (click)="open.set(true)"><app-icon name="card" />Pagar {{ charge().amount | money }}</button>
        } @else {
          <form class="stack" (ngSubmit)="pay()">
            <fieldset class="stack-sm">
              <legend class="text-base">Medio de pago</legend>
              <div class="segmented">
                @for (m of methodList; track m[0]) {
                  <label><input type="radio" name="method" [value]="m[0]" [(ngModel)]="method" />{{ m[1] }}</label>
                }
              </div>
            </fieldset>
            <div class="field">
              <label for="scenario">Resultado simulado</label>
              <select id="scenario" class="select" name="scenario" [(ngModel)]="scenario">
                <option value="APPROVE">Aprobar el pago</option>
                <option value="DECLINE_FUNDS">Rechazar por fondos insuficientes</option>
                <option value="DECLINE_BANK">Rechazar desde el banco</option>
              </select>
              <span class="hint">Modo de prueba: no se mueve dinero ni se piden datos de tarjeta o cuenta.</span>
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

  readonly charge = input.required<Charge>();
  readonly canPay = input(false);
  readonly paid = output<Charge>();

  readonly status = CHARGE_STATUS;
  readonly methods = PAYMENT_METHOD;
  readonly methodList = Object.entries(PAYMENT_METHOD);
  readonly open = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  method: PaymentMethod = 'SANDBOX_CARD';
  scenario = 'APPROVE';

  pay(): void {
    const charge = this.charge();
    this.busy.set(true);
    this.error.set(null);
    this.api
      .pay(charge.id, { reference: charge.reference, amount: charge.amount, method: this.method, scenario: this.scenario })
      .subscribe({
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
