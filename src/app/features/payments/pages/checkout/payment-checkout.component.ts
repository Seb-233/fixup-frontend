import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  PaymentControllerService,
  PaymentDetail,
  PaymentPurpose,
  PaymentSimulationOutcome,
  PaymentStatus
} from '../../../../api/generated';

@Component({
  selector: 'app-payment-checkout',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="checkout-container">
      <header class="checkout-header">
        <a [routerLink]="backLinkInfo().commands" class="back-link">{{ backLinkInfo().label }}</a>
        <div class="gateway-badge">
          <span class="lock-icon">🔒</span> Pasarela de pagos FixUp
        </div>
        <div class="academic-banner">
          <span class="academic-tag">SIMULACIÓN ACADÉMICA</span>
          <p class="academic-text">
            Este entorno no procesa dinero real ni requiere credenciales bancarias.
            Selecciona un resultado para simular el comportamiento de la pasarela.
          </p>
        </div>
      </header>

      @if (loading()) {
        <article class="card state-box">
          <p class="state">Cargando información del pago…</p>
        </article>
      } @else if (loadError()) {
        <article class="card state-box error">
          <p class="state error">{{ loadError() }}</p>
          <a routerLink="/requests" class="cta">Volver a mis solicitudes</a>
        </article>
      } @else if (payment(); as p) {
        <article class="card payment-summary">
          <h1 class="summary-title">Detalle del Pago</h1>

          <div class="summary-grid">
            <div class="summary-row">
              <span class="label">Propósito</span>
              <span class="value">{{ purposeLabel(p.purpose) }}</span>
            </div>
            <div class="summary-row">
              <span class="label">Método de pago</span>
              <span class="value">{{ p.paymentMethod === 'TRANSFER' ? 'Transferencia bancaria' : p.paymentMethod }}</span>
            </div>
            <div class="summary-row">
              <span class="label">Estado actual</span>
              <span class="status-badge" [class]="p.status.toLowerCase()">
                {{ statusLabel(p.status) }}
              </span>
            </div>
            <div class="summary-row total-row">
              <span class="label">Monto a pagar</span>
              <strong class="total-amount">{{ p.amount | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}</strong>
            </div>
          </div>

          <!-- ESTADO APPROVED -->
          @if (p.status === 'APPROVED') {
            <div class="result-banner approved" role="status">
              <div class="result-header">
                <span class="result-icon">✓</span>
                <h2 class="result-title">Pago aprobado</h2>
              </div>
              <p class="result-description">
                @if (p.purpose === 'SERVICE') {
                  El pago fue procesado exitosamente. El trabajo quedó habilitado y asignado al técnico.
                } @else {
                  El saldo pendiente fue saldado exitosamente. Tu cuenta ha quedado habilitada para registrar nuevas solicitudes.
                }
              </p>
              <div class="result-actions">
                @if (p.requestId) {
                  <a [routerLink]="['/requests', p.requestId]" class="btn-primary">Ver la solicitud</a>
                }
                <a [routerLink]="backLinkInfo().commands" class="btn-secondary">{{ backLinkInfo().label }}</a>
              </div>
            </div>
          }

          <!-- ESTADO DECLINED -->
          @if (p.status === 'DECLINED') {
            <div class="result-banner declined" role="alert">
              <div class="result-header">
                <span class="result-icon">✕</span>
                <h2 class="result-title">Pago rechazado</h2>
              </div>
              <p class="result-description">
                La entidad financiera simulada rechazó la transacción. Puedes reintentar la operación con este mismo pago.
              </p>
            </div>
          }

          <!-- ESTADO ERROR -->
          @if (p.status === 'ERROR') {
            <div class="result-banner error-banner" role="alert">
              <div class="result-header">
                <span class="result-icon">⚠</span>
                <h2 class="result-title">Error en la pasarela</h2>
              </div>
              <p class="result-description">
                Ocurrió un error simulado durante la comunicación con el procesador. Puedes reintentar.
              </p>
            </div>
          }

          <!-- ESTADO PENDING -->
          @if (p.status === 'PENDING') {
            <div class="result-banner pending-banner" role="status">
              <div class="result-header">
                <span class="result-icon">⏳</span>
                <h2 class="result-title">Pago pendiente</h2>
              </div>
              <p class="result-description">
                La transacción se encuentra en proceso de validación simulada. Puedes simular su resolución abajo.
              </p>
            </div>
          }

          <!-- SIMULADOR INTERACTIVO (habilitado si no está APPROVED) -->
          @if (p.status !== 'APPROVED') {
            <section class="simulation-panel">
              <h3 class="simulation-title">Panel de Control del Simulador</h3>
              <p class="simulation-subtitle">
                Elige el resultado académico a simular. La acción actualizará el backend de forma autoritativa.
              </p>

              @if (simulating()) {
                <div class="simulating-indicator">
                  <span class="spinner"></span>
                  <span>Procesando simulación autoritativa en backend…</span>
                </div>
              }

              @if (simulationError()) {
                <p class="field-error">{{ simulationError() }}</p>
              }

              <div class="simulation-actions">
                <button
                  type="button"
                  class="btn-outcome btn-approve"
                  [disabled]="simulating()"
                  (click)="simulateOutcome(outcomes.Approved)"
                >
                  <span class="outcome-icon">✓</span>
                  <span class="outcome-label">Aprobar pago</span>
                  <span class="outcome-desc">APPROVED</span>
                </button>

                <button
                  type="button"
                  class="btn-outcome btn-decline"
                  [disabled]="simulating()"
                  (click)="simulateOutcome(outcomes.Declined)"
                >
                  <span class="outcome-icon">✕</span>
                  <span class="outcome-label">Rechazar pago</span>
                  <span class="outcome-desc">DECLINED</span>
                </button>

                <button
                  type="button"
                  class="btn-outcome btn-pending"
                  [disabled]="simulating()"
                  (click)="simulateOutcome(outcomes.Pending)"
                >
                  <span class="outcome-icon">⏳</span>
                  <span class="outcome-label">Dejar pendiente</span>
                  <span class="outcome-desc">PENDING</span>
                </button>

                <button
                  type="button"
                  class="btn-outcome btn-error"
                  [disabled]="simulating()"
                  (click)="simulateOutcome(outcomes.Error)"
                >
                  <span class="outcome-icon">⚠</span>
                  <span class="outcome-label">Simular error</span>
                  <span class="outcome-desc">ERROR</span>
                </button>
              </div>
            </section>
          }
        </article>
      }
    </section>
  `,
  styles: [`
    .checkout-container {
      max-width: 680px;
      margin: 0 auto;
      padding: 1.5rem 1rem 3rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .back-link {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--fixup-color-accent, #B9975B);
      text-decoration: none;
      display: inline-block;
      margin-bottom: 0.5rem;
    }
    .back-link:hover { text-decoration: underline; }

    .gateway-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--fixup-color-primary, #2D2E31);
      margin-bottom: 0.5rem;
    }
    .lock-icon { font-size: 1.1rem; }

    .academic-banner {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: var(--fixup-radius-md, 8px);
      padding: 0.85rem 1rem;
    }
    .academic-tag {
      display: inline-block;
      font-size: 0.72rem;
      font-weight: 800;
      letter-spacing: 0.05em;
      color: #1e40af;
      background: #dbeafe;
      border-radius: 4px;
      padding: 0.15rem 0.45rem;
      margin-bottom: 0.25rem;
    }
    .academic-text {
      font-size: 0.82rem;
      color: #1e3a8a;
      margin: 0;
      line-height: 1.4;
    }

    .card {
      background: #fff;
      border: 1px solid rgba(154, 148, 141, 0.2);
      border-radius: var(--fixup-radius-lg, 12px);
      padding: 1.5rem;
      box-shadow: var(--fixup-shadow-sm, 0 1px 3px rgba(0, 0, 0, 0.05));
    }

    .summary-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--fixup-color-primary, #2D2E31);
      margin: 0 0 1.2rem 0;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid #eee;
    }

    .summary-grid {
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
      margin-bottom: 1.5rem;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.9rem;
    }
    .summary-row .label { color: #666; }
    .summary-row .value { font-weight: 600; color: #2D2E31; }

    .total-row {
      padding-top: 0.75rem;
      border-top: 1px dashed #ddd;
      margin-top: 0.25rem;
    }
    .total-row .label {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--fixup-color-primary, #2D2E31);
    }
    .total-amount {
      font-size: 1.4rem;
      font-weight: 800;
      color: var(--fixup-color-primary, #2D2E31);
    }

    .status-badge {
      border-radius: 999px;
      padding: 0.2rem 0.65rem;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
    }
    .status-badge.pending { background: #fef3c7; color: #92400e; }
    .status-badge.approved { background: #d1fae5; color: #065f46; }
    .status-badge.declined { background: #fee2e2; color: #991b1b; }
    .status-badge.error { background: #f3f4f6; color: #374151; }

    .result-banner {
      border-radius: var(--fixup-radius-md, 8px);
      padding: 1.25rem;
      margin-bottom: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }
    .result-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .result-icon {
      font-size: 1.2rem;
      font-weight: 800;
      line-height: 1;
    }
    .result-title {
      font-size: 1.1rem;
      font-weight: 700;
      margin: 0;
    }
    .result-description {
      font-size: 0.88rem;
      margin: 0;
      line-height: 1.45;
    }

    .result-banner.approved {
      background: #ecfdf5;
      border: 1px solid #a7f3d0;
      color: #065f46;
    }
    .result-banner.declined {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #991b1b;
    }
    .result-banner.error-banner {
      background: #fffbeb;
      border: 1px solid #fde68a;
      color: #92400e;
    }
    .result-banner.pending-banner {
      background: #fafaf9;
      border: 1px solid #e7e5e4;
      color: #44403c;
    }

    .result-actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 0.5rem;
      flex-wrap: wrap;
    }
    .btn-primary {
      background: var(--fixup-color-primary, #2D2E31);
      color: #fff;
      padding: 0.6rem 1.15rem;
      border-radius: 6px;
      font-size: 0.86rem;
      font-weight: 700;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
    }
    .btn-primary:hover { opacity: 0.92; }

    .btn-secondary {
      background: #fff;
      color: #4A463F;
      border: 1px solid #ddd7cd;
      padding: 0.6rem 1.15rem;
      border-radius: 6px;
      font-size: 0.86rem;
      font-weight: 600;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
    }
    .btn-secondary:hover { background: #fbf8f2; }

    .simulation-panel {
      padding-top: 1.25rem;
      border-top: 1px solid #eee;
      display: flex;
      flex-direction: column;
      gap: 0.8rem;
    }
    .simulation-title {
      font-size: 1rem;
      font-weight: 700;
      color: #2D2E31;
      margin: 0;
    }
    .simulation-subtitle {
      font-size: 0.82rem;
      color: #666;
      margin: 0;
    }

    .simulating-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      color: #1e40af;
      padding: 0.5rem 0;
    }
    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid #3b82f6;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .field-error {
      color: #b91c1c;
      font-size: 0.84rem;
      margin: 0;
    }

    .simulation-actions {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 0.75rem;
      margin-top: 0.25rem;
    }
    @media (max-width: 520px) {
      .simulation-actions { grid-template-columns: 1fr; }
    }

    .btn-outcome {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0.85rem;
      border-radius: 8px;
      border: 1px solid;
      cursor: pointer;
      gap: 0.2rem;
      transition: all 0.15s ease;
      font: inherit;
      background: #fff;
    }
    .btn-outcome:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .outcome-icon { font-size: 1.25rem; }
    .outcome-label { font-size: 0.88rem; font-weight: 700; }
    .outcome-desc { font-size: 0.68rem; font-weight: 800; letter-spacing: 0.04em; opacity: 0.75; }

    .btn-approve {
      border-color: #10b981;
      color: #047857;
      background: #ecfdf5;
    }
    .btn-approve:hover:not(:disabled) {
      background: #d1fae5;
    }

    .btn-decline {
      border-color: #ef4444;
      color: #b91c1c;
      background: #fef2f2;
    }
    .btn-decline:hover:not(:disabled) {
      background: #fee2e2;
    }

    .btn-pending {
      border-color: #f59e0b;
      color: #b45309;
      background: #fffbeb;
    }
    .btn-pending:hover:not(:disabled) {
      background: #fef3c7;
    }

    .btn-error {
      border-color: #6b7280;
      color: #374151;
      background: #f9fafb;
    }
    .btn-error:hover:not(:disabled) {
      background: #f3f4f6;
    }

    .state-box {
      text-align: center;
      padding: 2.5rem 1.5rem;
    }
    .state { color: #666; font-size: 0.9rem; margin: 0; }
    .state.error { color: #b91c1c; margin-bottom: 0.75rem; }
    .cta { color: var(--fixup-color-accent, #B9975B); font-weight: 700; text-decoration: none; }
    .cta:hover { text-decoration: underline; }
  `]
})
export class PaymentCheckoutComponent implements OnInit {
  private readonly paymentsApi = inject(PaymentControllerService);
  private readonly route = inject(ActivatedRoute);

  readonly paymentId = this.route.snapshot.paramMap.get('paymentId') ?? '';
  readonly payment = signal<PaymentDetail | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly simulating = signal(false);
  readonly simulationError = signal<string | null>(null);

  readonly outcomes = PaymentSimulationOutcome;
  readonly statuses = PaymentStatus;

  readonly fromContext = computed(() => this.route.snapshot.queryParamMap?.get('from') ?? null);
  readonly projectIdContext = computed(() => this.route.snapshot.queryParamMap?.get('projectId') ?? null);

  readonly backLinkInfo = computed(() => {
    const from = this.fromContext();
    const projectId = this.projectIdContext();
    if (from === 'remodelings' && projectId) {
      return {
        commands: ['/remodelings', projectId],
        label: '← Volver al proyecto de remodelación'
      };
    }
    return {
      commands: ['/requests'],
      label: '← Volver a mis solicitudes'
    };
  });

  ngOnInit(): void {
    if (!this.paymentId) {
      this.loadError.set('Identificador de pago no especificado.');
      this.loading.set(false);
      return;
    }
    this.loadPayment();
  }

  loadPayment(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.paymentsApi.payment(this.paymentId).subscribe({
      next: (detail: PaymentDetail) => {
        this.payment.set(detail);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.loadError.set(
          error.status === 404
            ? 'El pago solicitado no existe o ha expirado.'
            : error.status === 403
            ? 'No tienes permiso para acceder a este pago.'
            : 'No pudimos cargar la información del pago.'
        );
      }
    });
  }

  simulateOutcome(outcome: PaymentSimulationOutcome): void {
    if (!this.paymentId || this.simulating()) return;

    this.simulating.set(true);
    this.simulationError.set(null);

    this.paymentsApi.simulate(this.paymentId, { outcome }).subscribe({
      next: () => {
        // Regla autoritativa: volver a consultar GET payment para pintar el estado real de backend
        this.paymentsApi.payment(this.paymentId).subscribe({
          next: (refetched: PaymentDetail) => {
            this.payment.set(refetched);
            this.simulating.set(false);
          },
          error: () => {
            this.simulating.set(false);
            this.simulationError.set('Se procesó la simulación pero no pudimos refrescar el estado. Recarga la página.');
          }
        });
      },
      error: (error: HttpErrorResponse) => {
        this.simulating.set(false);
        this.simulationError.set(
          error.status === 409
            ? 'Este pago ya se encuentra en un estado terminal y no admite nuevas transiciones.'
            : 'Error al simular el pago en el backend. Intenta nuevamente.'
        );
      }
    });
  }

  purposeLabel(purpose?: PaymentPurpose | string): string {
    switch (purpose) {
      case PaymentPurpose.Service:
        return 'Servicio de reparación';
      case PaymentPurpose.OutstandingBalance:
        return 'Saldo pendiente (deuda por efectivo no liquidado)';
      default:
        return purpose ?? 'Pago de servicio';
    }
  }

  statusLabel(status?: PaymentStatus | string): string {
    switch (status) {
      case PaymentStatus.Pending:
        return 'Pendiente';
      case PaymentStatus.Approved:
        return 'Aprobado';
      case PaymentStatus.Declined:
        return 'Rechazado';
      case PaymentStatus.Error:
        return 'Error';
      default:
        return status ?? '';
    }
  }
}
