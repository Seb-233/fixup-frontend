import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { KnownPaymentsService } from '../../data/known-payments';
import { PaymentAttemptResult, PaymentDetail, SandboxPaymentInstrument } from '../../data/models';
import { WorkApi } from '../../data/work.api';
import {
  PAYMENT_METHOD,
  PAYMENT_PURPOSE,
  PAYMENT_STATUS,
  SANDBOX_PAYMENT_INSTRUMENT,
  errorMessage,
  generateUuid
} from '../../shared/format';
import { losslessParse, losslessStringify } from '../../data/lossless-json';
import { IconComponent } from '../../shared/ui/icon.component';
import { LabelPipe, MoneyPipe, WhenPipe } from '../../shared/ui/pipes';
import { StatusComponent } from '../../shared/ui/status.component';

interface PendingAttemptPayload {
  key: string;
  instrument: SandboxPaymentInstrument;
  amount: number | bigint;
  reference: string;
  startedAt: string;
}

// Pago 100 % digital en pasarela simulada (FR-UC-05.4).
// Procesa intentos mediante POST /payments/{paymentId}/attempts con Idempotency-Key y refresco por GET.
@Component({
  selector: 'app-payment-panel',
  imports: [FormsModule, IconComponent, StatusComponent, MoneyPipe, WhenPipe, LabelPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel stack" aria-labelledby="pay-title">
      <div class="spread">
        <h2 id="pay-title" class="text-lg">Pago digital</h2>
        <app-status [map]="status" [value]="payment().status" />
      </div>

      <dl class="facts">
        <div><dt>Valor exacto</dt><dd class="price">{{ payment().amount | money }}</dd></div>
        <div><dt>Referencia</dt><dd>{{ payment().reference || ('FIX-' + payment().paymentId.slice(0, 8)) }}</dd></div>
        <div><dt>Método</dt><dd>{{ payment().paymentMethod | label: methods }}</dd></div>
        <div class="wide"><dt>Concepto</dt><dd>{{ payment().purpose | label: purposes }}</dd></div>
      </dl>

      <div class="alert alert-info text-sm" role="status">
        <app-icon name="info" />
        <span>Pasarela académica de prueba: simulación digital sin dinero real ni solicitud de claves bancarias.</span>
      </div>

      @switch (payment().status) {
        @case ('APPROVED') {
          <p class="text-sm">
            Pagado el {{ payment().completedAt | when }};
            {{ payment().purpose === 'SERVICE' ? 'el trabajo ya quedó abierto y disponible para el técnico en Mis trabajos.' : 'la deuda quedó saldada.' }}
          </p>
        }
        @case ('PENDING') {
          <p class="text-sm">
            {{ payment().purpose === 'SERVICE' ? 'El trabajo se abre únicamente cuando este pago quede aprobado.' : 'Mientras el saldo siga pendiente no puedes abrir otra solicitud.' }}
          </p>
        }
        @default {
          <div class="alert alert-danger" role="status">
            {{ lastFailure() || 'El último intento de pago no fue aprobado. Puedes intentar nuevamente con otro instrumento.' }}
          </div>
        }
      }

      @if (lastAttempt(); as att) {
        <div class="panel panel-quiet stack-sm text-sm">
          <div class="spread">
            <span class="font-medium">Último intento: {{ att.instrument ? instruments[att.instrument] : 'Simulado' }}</span>
            <app-status [map]="status" [value]="att.status" />
          </div>
          @if (att.gatewayTransactionId) {
            <div class="text-xs text-muted">ID Transacción: {{ att.gatewayTransactionId }}</div>
          }
          @if (att.failureReason) {
            <div class="text-danger">Motivo: {{ att.failureReason }}</div>
          }
        </div>
      }

      @if (canPay() && payment().status !== 'APPROVED') {
        @if (!open()) {
          <button type="button" class="btn btn-primary" (click)="open.set(true)">
            <app-icon name="card" />Pagar {{ payment().amount | money }}
          </button>
        } @else {
          <form class="stack" (ngSubmit)="pay(false)">
            @if (hasPendingRetry()) {
              <div class="alert alert-warning text-sm" role="status">
                <app-icon name="alert-triangle" />
                <span>Hay un intento pendiente sin confirmación. Al reintentar se mantendrá la misma clave de idempotencia e instrumento para evitar duplicaciones.</span>
              </div>
            }

            <div class="field">
              <label for="instrument">Instrumento de pago simulado</label>
              <select id="instrument" class="select" name="instrument" [(ngModel)]="instrument" [disabled]="busy() || hasPendingRetry()">
                @for (entry of instrumentOptions; track entry.key) {
                  <option [value]="entry.key">{{ entry.label }}</option>
                }
              </select>
            </div>

            @if (error()) {
              <div class="alert alert-danger" role="alert">{{ error() }}</div>
            }

            <div class="cluster">
              <button type="submit" class="btn btn-primary" [disabled]="busy()">
                {{ busy() ? 'Procesando en pasarela…' : (hasPendingRetry() ? 'Reintentar operación pendiente' : 'Confirmar pago simulado') }}
              </button>
              @if (hasPendingRetry()) {
                <button type="button" class="btn btn-secondary" [disabled]="busy()" (click)="pay(true)">
                  Nuevo intento con nueva clave
                </button>
              }
              <button type="button" class="btn btn-ghost" [disabled]="busy()" (click)="open.set(false)">
                Volver
              </button>
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
  private readonly userStore = inject(CurrentUserStore);
  private readonly knownPayments = inject(KnownPaymentsService);

  readonly payment = input.required<PaymentDetail>();
  readonly canPay = input(false);
  readonly paid = output<PaymentDetail>();

  readonly status = PAYMENT_STATUS;
  readonly methods = PAYMENT_METHOD;
  readonly purposes = PAYMENT_PURPOSE;
  readonly instruments = SANDBOX_PAYMENT_INSTRUMENT;

  readonly instrumentOptions: { key: SandboxPaymentInstrument; label: string }[] = [
    { key: 'SANDBOX_CARD', label: SANDBOX_PAYMENT_INSTRUMENT['SANDBOX_CARD'] },
    { key: 'SANDBOX_PSE', label: SANDBOX_PAYMENT_INSTRUMENT['SANDBOX_PSE'] },
    { key: 'SANDBOX_NEQUI', label: SANDBOX_PAYMENT_INSTRUMENT['SANDBOX_NEQUI'] }
  ];

  instrument: SandboxPaymentInstrument = 'SANDBOX_CARD';

  readonly open = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly lastFailure = signal<string | null>(null);
  readonly lastAttempt = signal<PaymentAttemptResult | null>(null);
  readonly hasPendingRetry = signal<boolean>(false);

  constructor() {
    effect(() => {
      const p = this.payment();
      if (p) {
        this.checkPendingAttempt(p.paymentId);
      }
    });
  }

  private sessionKey(paymentId: string): string {
    const userId = this.userStore.user()?.id ?? 'anon';
    return `fixup_pending_attempt_${userId}_${paymentId}`;
  }

  private checkPendingAttempt(paymentId: string): void {
    try {
      const raw = sessionStorage.getItem(this.sessionKey(paymentId));
      if (raw) {
        const payload = losslessParse<PendingAttemptPayload>(raw);
        if (payload?.key) {
          this.hasPendingRetry.set(true);
          this.instrument = payload.instrument || 'SANDBOX_CARD';
          return;
        }
      }
    } catch {
      // Ignorar fallo de parseo
    }
    this.hasPendingRetry.set(false);
  }

  private savePendingAttempt(payload: PendingAttemptPayload): void {
    try {
      sessionStorage.setItem(this.sessionKey(this.payment().paymentId), losslessStringify(payload));
    } catch {
      // Ignorar restricciones de storage
    }
  }

  private clearPendingAttempt(): void {
    try {
      sessionStorage.removeItem(this.sessionKey(this.payment().paymentId));
    } catch {
      // Ignorar restricciones de storage
    }
    this.hasPendingRetry.set(false);
  }

  pay(forceNew = false): void {
    if (this.busy()) {
      return;
    }
    const current = this.payment();
    if (current.status === 'APPROVED') {
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    this.lastFailure.set(null);

    let idempotencyKey: string;
    let chosenInstrument: SandboxPaymentInstrument = this.instrument;
    const amount = current.amount;
    const reference = current.reference || `FIX-${current.paymentId.slice(0, 8)}`;

    const storedRaw = sessionStorage.getItem(this.sessionKey(current.paymentId));
    let stored: PendingAttemptPayload | null = null;
    if (storedRaw) {
      try {
        stored = losslessParse<PendingAttemptPayload>(storedRaw);
      } catch {
        // Ignorar JSON corrupto en sessionStorage
      }
    }

    if (!forceNew && stored?.key) {
      // Reutiliza la misma clave y parámetros exactos del intento pendiente
      idempotencyKey = stored.key;
      chosenInstrument = stored.instrument;
    } else {
      // Intento genuinamente nuevo
      idempotencyKey = generateUuid();
      this.savePendingAttempt({
        key: idempotencyKey,
        instrument: chosenInstrument,
        amount,
        reference,
        startedAt: new Date().toISOString()
      });
    }

    this.api
      .attempt(current.paymentId, idempotencyKey, {
        reference,
        amount,
        instrument: chosenInstrument
      })
      .subscribe({
        next: (attemptResult) => {
          this.clearPendingAttempt();
          this.lastAttempt.set(attemptResult);

          if (attemptResult.status === 'DECLINED' || attemptResult.status === 'ERROR') {
            const reason = attemptResult.failureReason || 'El intento de pago no fue aprobado por la pasarela simulada.';
            this.lastFailure.set(reason);
            this.error.set(reason);
          }

          // Consultar siempre GET autoritativo del pago tras el intento
          this.refreshPayment(current.paymentId);
        },
        error: (failure) => {
          this.busy.set(false);
          const status = failure?.status;
          if (status === 0 || status === 502 || status === 503 || status === 504) {
            // Falla de red, timeout o error de gateway: resultado incierto. Conservar la clave para reintento idéntico
            this.hasPendingRetry.set(true);
            this.error.set(
              'No se pudo confirmar la respuesta de la pasarela. Se conservó la clave de idempotencia para que puedas reintentar de manera segura.'
            );
          } else {
            // Error determinista devuelto por el backend
            this.clearPendingAttempt();
            this.error.set(errorMessage(failure, 'No pudimos procesar el intento de pago.'));
            this.refreshPayment(current.paymentId);
          }
        }
      });
  }

  private refreshPayment(paymentId: string): void {
    this.api.payment(paymentId).subscribe({
      next: (fresh) => {
        this.busy.set(false);
        this.knownPayments.updateStatus(paymentId, fresh.status);
        this.paid.emit(fresh);
        if (fresh.status === 'APPROVED') {
          this.open.set(false);
        }
      },
      error: () => {
        this.busy.set(false);
      }
    });
  }
}
