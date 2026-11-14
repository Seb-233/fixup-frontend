import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { KnownPaymentsService } from '../../data/known-payments';
import { PaymentAttemptResult, PaymentDetail, SandboxPaymentInstrument, WompiStatus } from '../../data/models';
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

// Pago 100 % digital (FR-UC-05.4) con dos pasarelas:
// - Wompi (INT-01), cuando el backend tiene las llaves: el pagador paga en el checkout alojado de Wompi,
//   vuelve a /payments/{paymentId}?id=<transacción> y el backend verifica la transacción con Wompi.
// - La pasarela simulada: POST /payments/{paymentId}/attempts con Idempotency-Key y refresco por GET.
const WOMPI_POLL_MS = 3000;
const WOMPI_MAX_POLLS = 10;

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
        @if (wompi()?.enabled) {
          <span>
            Pagos con Wompi{{ wompi()?.environment === 'sandbox' ? ' en ambiente de pruebas (sandbox): no se mueve dinero real' : '' }}.
            Tus datos de pago los recibe Wompi, nunca FixUp.
          </span>
        } @else {
          <span>Pasarela académica de prueba: simulación digital sin dinero real ni solicitud de claves bancarias.</span>
        }
      </div>

      @if (wompiChecking()) {
        <div class="alert alert-info text-sm" role="status" aria-live="polite">
          <app-icon name="refresh" />
          <span>Verificando el pago con Wompi…</span>
        </div>
      } @else if (wompiRetryId()) {
        @if (wompiPendingId(); as pendingId) {
          <div class="alert alert-warning text-sm" role="status">
            <app-icon name="clock" />
            <span>Wompi todavía no confirma la transacción {{ pendingId }}. Puede tardar unos minutos con PSE o Nequi.</span>
          </div>
        }
        <div class="cluster">
          <button type="button" class="btn btn-secondary" (click)="verifyWompi()">
            <app-icon name="refresh" />Verificar de nuevo
          </button>
        </div>
      }

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

      @if (!open() && error() && !wompiChecking()) {
        <div class="alert alert-danger" role="alert">{{ error() }}</div>
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

      @if (canPay() && payment().status !== 'APPROVED' && !wompiChecking()) {
        @if (!open()) {
          <button type="button" class="btn btn-primary" (click)="startPayment()">
            <app-icon name="card" />Pagar {{ payment().amount | money }}
          </button>
        } @else {
          @if (wompi()?.enabled) {
            <div class="panel panel-quiet stack-sm">
              <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="payWithWompi()">
                <app-icon name="external" />{{ redirecting() ? 'Abriendo Wompi…' : 'Pagar con Wompi' }}
              </button>
              <p class="text-xs text-muted">
                Te llevamos a la página segura de Wompi para pagar {{ payment().amount | money }} con tarjeta, PSE o Nequi.
                Al terminar vuelves aquí y FixUp verifica el resultado directamente con Wompi.
              </p>
            </div>
            <p class="text-sm text-muted">También puedes usar la pasarela simulada:</p>
          }
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

  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router, { optional: true });
  readonly wompi = signal<WompiStatus | null>(null);
  readonly redirecting = signal(false);
  readonly wompiChecking = signal(false);
  readonly wompiPendingId = signal<string | null>(null);
  readonly wompiRetryId = signal<string | null>(null);
  private wompiReturnHandled = false;
  private wompiStatusRequested = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const p = this.payment();
      if (p) {
        this.checkPendingAttempt(p.paymentId);
        if (this.canPay() && p.status !== 'APPROVED') {
          untracked(() => this.loadWompiStatus());
        }
      }
    });
    // Wompi devuelve al pagador a /payments/{paymentId}?id=<transacción>.
    effect(() => {
      const p = this.payment();
      const transactionId = this.route?.snapshot.queryParamMap.get('id');
      if (!p || !transactionId || this.wompiReturnHandled) {
        return;
      }
      this.wompiReturnHandled = true;
      untracked(() => {
        this.loadWompiStatus();
        this.confirmWompi(p.paymentId, transactionId, 0);
      });
    });
    inject(DestroyRef).onDestroy(() => this.stopPolling());
  }

  startPayment(): void {
    this.open.set(true);
    this.loadWompiStatus();
  }

  payWithWompi(): void {
    if (this.busy()) {
      return;
    }
    const current = this.payment();
    this.busy.set(true);
    this.redirecting.set(true);
    this.error.set(null);
    const returnUrl = new URL(`payments/${current.paymentId}`, document.baseURI).toString();
    this.api.wompiCheckout(current.paymentId, returnUrl).subscribe({
      next: (session) => this.redirect(session.checkoutUrl),
      error: (failure) => {
        this.busy.set(false);
        this.redirecting.set(false);
        this.error.set(errorMessage(failure, 'No pudimos abrir el checkout de Wompi.'));
      }
    });
  }

  verifyWompi(): void {
    const transactionId = this.wompiRetryId();
    if (transactionId) {
      this.confirmWompi(this.payment().paymentId, transactionId, 0);
    }
  }

  /** Separado para poder reemplazarlo en las pruebas: navegar fuera de la SPA. */
  redirect(url: string): void {
    window.location.assign(url);
  }

  private loadWompiStatus(): void {
    if (this.wompiStatusRequested) {
      return;
    }
    this.wompiStatusRequested = true;
    this.api.wompiStatus().subscribe({
      next: (status) => this.wompi.set(status),
      error: () => this.wompi.set({ enabled: false })
    });
  }

  private confirmWompi(paymentId: string, transactionId: string, round: number): void {
    this.stopPolling();
    this.wompiChecking.set(true);
    this.error.set(null);
    this.api.wompiConfirm(paymentId, transactionId).subscribe({
      next: (result) => {
        if (result.attempt) {
          this.lastAttempt.set(result.attempt);
        }
        if (result.transactionStatus === 'PENDING') {
          this.wompiPendingId.set(transactionId);
          this.wompiRetryId.set(transactionId);
          if (round + 1 < WOMPI_MAX_POLLS) {
            this.pollTimer = setTimeout(() => this.confirmWompi(paymentId, transactionId, round + 1), WOMPI_POLL_MS);
          } else {
            this.wompiChecking.set(false);
          }
          return;
        }
        this.wompiPendingId.set(null);
        this.wompiRetryId.set(null);
        this.wompiChecking.set(false);
        if (result.paymentStatus !== 'APPROVED') {
          const reason = result.attempt?.failureReason ?? 'Wompi no aprobó la transacción. Puedes intentar de nuevo.';
          this.lastFailure.set(reason);
        }
        this.clearReturnParam();
        this.refreshPayment(paymentId);
      },
      error: (failure) => {
        this.wompiChecking.set(false);
        this.wompiPendingId.set(null);
        this.wompiRetryId.set(transactionId);
        this.error.set(errorMessage(failure, 'No pudimos verificar el pago con Wompi.'));
      }
    });
  }

  private clearReturnParam(): void {
    if (this.router && this.route) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { id: null, env: null },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
    }
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
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
