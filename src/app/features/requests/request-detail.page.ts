import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Observable, catchError, map, of } from 'rxjs';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { CashSettlementDetail, JobDetail, PaymentDetail, QuotationResponse, VisitResponse, AcceptedQuotationResponse } from '../../data/models';
import { KnownPaymentsService } from '../../data/known-payments';
import { RequestsApi } from '../../data/requests.api';
import { WorkApi } from '../../data/work.api';
import { PAYMENT_METHOD, QUOTATION_STATUS, REQUEST_STATUS, SLA_STATE, SPECIALTY, URGENCY, errorMessage } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';
import { PhotoComponent } from '../../shared/ui/photo.component';
import { AgoPipe, DayPipe, LabelPipe, MoneyPipe, WhenPipe } from '../../shared/ui/pipes';
import { StarsComponent } from '../../shared/ui/stars.component';
import { ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';
import { StatusComponent } from '../../shared/ui/status.component';
import { JobProgressComponent } from '../work/job-progress.component';
import { PaymentPanelComponent } from '../work/payment-panel.component';
import { FixerChoice, ProposeVisitComponent } from '../work/propose-visit.component';
import { RatingPanelComponent } from '../work/rating-panel.component';
import { VisitCardComponent } from '../work/visit-card.component';

interface Step {
  label: string;
  done: boolean;
}

@Component({
  selector: 'app-request-detail-page',
  imports: [
    FormsModule,
    RouterLink,
    IconComponent,
    PhotoComponent,
    StatusComponent,
    StarsComponent,
    MoneyPipe,
    DayPipe,
    WhenPipe,
    AgoPipe,
    LabelPipe,
    LoadingComponent,
    ErrorStateComponent,
    VisitCardComponent,
    ProposeVisitComponent,
    JobProgressComponent,
    PaymentPanelComponent,
    RatingPanelComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './request-detail.page.html',
  styleUrl: './request-detail.page.scss'
})
export class RequestDetailPage {
  private readonly requests = inject(RequestsApi);
  private readonly work = inject(WorkApi);
  private readonly user = inject(CurrentUserStore);
  private readonly knownPayments = inject(KnownPaymentsService);
  private readonly router = inject(Router);

  readonly requestId = input.required<string>();
  readonly statusMap = REQUEST_STATUS;
  readonly urgency = URGENCY;
  readonly sla = SLA_STATE;
  readonly specialty = SPECIALTY;
  readonly quotationStatus = QUOTATION_STATUS;
  readonly methods = PAYMENT_METHOD;
  readonly me = computed(() => this.user.user()?.id);
  readonly role = this.user.activeRole;

  readonly request = rxResource({
    params: () => this.requestId(),
    stream: ({ params }) => this.requests.get(params)
  });

  readonly isDecider = computed(() => {
    if (!this.request.hasValue()) return false;
    const r = this.request.value();
    return r.ownerUserId === this.me() || (!!r.managerUserId && r.managerUserId === this.me());
  });
  /** Solo el propietario o el administrador vigente pueden pagar */
  readonly canPay = computed(() => {
    const role = this.role();
    if (role !== 'OWNER' && role !== 'REAL_ESTATE_MANAGER') return false;
    return this.isDecider();
  });
  readonly isRequester = computed(() => this.request.hasValue() && this.request.value().requestedByUserId === this.me());
  readonly isAssignedFixer = computed(() => this.request.hasValue() && this.request.value().assignedFixerUserId === this.me());
  readonly isOtherFixer = computed(() => this.role() === 'FIXER' && !this.isAssignedFixer());
  readonly isOpen = computed(() => this.request.hasValue() && this.request.value().status === 'OPEN');
  /** Presencia de técnico asignado en la solicitud */
  readonly hasAssignedFixer = computed(() => this.request.hasValue() && !!this.request.value().assignedFixerUserId);
  /** Un trabajo solo existe de forma efectiva cuando el pago está aprobado (o cash histórico) */
  readonly hasJob = computed(() => this.job.hasValue() && !!this.job.value());
  readonly isParticipant = computed(() => this.isDecider() || this.isRequester() || this.isAssignedFixer());

  // Cotizaciones: las ve quien decide. El técnico ve la suya en "Mis cotizaciones".
  readonly quotations = rxResource({
    params: () => (this.isDecider() ? this.requestId() : undefined),
    stream: ({ params }) => this.requests.quotations(params)
  });
  readonly myQuotation = rxResource({
    params: () => (this.role() === 'FIXER' ? this.requestId() : undefined),
    // Un técnico cotiza una sola vez por solicitud.
    stream: ({ params }) =>
      this.requests.myQuotations().pipe(
        map((list) => list.find((q) => q.requestId === params) ?? null),
        catchError(() => of<QuotationResponse | null>(null))
      )
  });

  readonly visits = rxResource({
    params: () => (this.isParticipant() || this.role() === 'FIXER' ? this.requestId() : undefined),
    stream: ({ params }) => this.work.visitsForRequest(params).pipe(catchError(() => of<VisitResponse[]>([])))
  });

  readonly job = rxResource({
    params: () => (this.hasAssignedFixer() && (this.isParticipant() || this.role() === 'PLATFORM_ADMIN') ? this.requestId() : undefined),
    stream: ({ params }) => this.work.jobForRequest(params).pipe(catchError(() => of<JobDetail | null>(null)))
  });

  // Operación 100 % digital: el pago digital precede a la apertura del trabajo.
  readonly isTransfer = computed(() => this.request.hasValue() && this.request.value().paymentMethod !== 'CASH');
  readonly knownPaymentId = computed(() => this.knownPayments.findForRequest(this.requestId())?.paymentId ?? null);
  readonly payment = rxResource({
    params: () => (this.knownPaymentId() && (this.canPay() || this.role() === 'PLATFORM_ADMIN') ? this.knownPaymentId()! : undefined),
    stream: ({ params }) => this.work.payment(params).pipe(catchError(() => of<PaymentDetail | null>(null)))
  });
  readonly cash = rxResource({
    params: () => {
      if (!this.request.hasValue() || this.request.value().paymentMethod !== 'CASH' || this.request.value().status !== 'COMPLETED') return undefined;
      if (!this.isDecider() && !this.isAssignedFixer() && this.role() !== 'PLATFORM_ADMIN') return undefined;
      return this.job.hasValue() && this.job.value() ? this.job.value()!.job.id : undefined;
    },
    stream: ({ params }) => this.work.cashSettlement(params).pipe(catchError(() => of<CashSettlementDetail | null>(null)))
  });
  /** Cotización aceptada pero trabajo aún no abierto por pago digital pendiente */
  readonly awaitingPayment = computed(() => {
    if (!this.hasAssignedFixer()) return false;
    if (this.hasJob()) return false;
    const r = this.request.value();
    if (!r || r.status === 'COMPLETED' || r.status === 'CANCELLED') return false;
    return this.isTransfer();
  });

  readonly steps = computed<Step[]>(() => {
    if (!this.request.hasValue()) return [];
    const r = this.request.value();
    const quoted = (this.quotations.hasValue() && this.quotations.value().length > 0) || !!r.assignedFixerUserId;
    const completed = r.status === 'COMPLETED';
    // Un trabajo por transferencia solo existe con el pago aprobado; el efectivo se liquida al terminar.
    const paid = r.paymentMethod === 'CASH' ? completed : (this.job.hasValue() && !!this.job.value()) || (this.payment.hasValue() && this.payment.value()?.status === 'APPROVED');
    const steps: Step[] = [
      { label: 'Reportada', done: true },
      { label: 'Cotizaciones', done: quoted },
      { label: 'Técnico asignado', done: !!r.assignedFixerUserId },
      { label: 'Trabajo terminado', done: completed }
    ];
    // El pago solo lo ven quien paga, el técnico y soporte; para los demás ese paso no existe.
    if (this.isDecider() || this.isAssignedFixer() || this.role() === 'PLATFORM_ADMIN') {
      steps.splice(3, 0, { label: r.paymentMethod === 'CASH' ? 'Pago en efectivo' : 'Pagado', done: paid });
    }
    return steps;
  });

  readonly sortedQuotations = computed(() => {
    if (!this.quotations.hasValue()) return [];
    return [...this.quotations.value()].sort((a, b) => a.amount - b.amount);
  });
  readonly cheapest = computed(() => this.sortedQuotations().find((q) => q.status === 'SUBMITTED')?.id);

  readonly visitFixers = computed<FixerChoice[]>(() => {
    if (!this.request.hasValue()) return [];
    const r = this.request.value();
    if (r.assignedFixerUserId) return [{ id: r.assignedFixerUserId, name: r.assignedFixerName ?? 'Técnico asignado' }];
    return this.sortedQuotations()
      .filter((q) => q.status === 'SUBMITTED')
      .map((q) => ({ id: q.fixerUserId, name: q.fixerName ?? 'Técnico' }));
  });
  readonly visitKinds = computed(() =>
    this.request.hasValue() && this.request.value().assignedFixerUserId
      ? [
          { value: 'EXECUTION' as const, label: 'Ejecución del trabajo' },
          { value: 'DIAGNOSTIC' as const, label: 'Diagnóstico' },
          { value: 'KITCHEN_ASSESSMENT' as const, label: 'Valoración de cocina' }
        ]
      : [
          { value: 'DIAGNOSTIC' as const, label: 'Diagnóstico' },
          { value: 'KITCHEN_ASSESSMENT' as const, label: 'Valoración de cocina' }
        ]
  );
  readonly canProposeVisit = computed(() => {
    if (!this.request.hasValue()) return false;
    const status = this.request.value().status;
    if (status === 'COMPLETED' || status === 'CANCELLED') return false;
    if (this.isAssignedFixer()) return true;
    if (this.role() === 'FIXER') return this.myQuotation.hasValue() && this.myQuotation.value()?.status === 'SUBMITTED';
    return (this.isDecider() || this.isRequester()) && this.visitFixers().length > 0;
  });
  readonly canRate = computed(() => (this.isDecider() || this.isRequester()) && this.request.hasValue() && this.request.value().status === 'COMPLETED');

  readonly proposing = signal(false);
  readonly busy = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  // Cotización del técnico
  quoteAmount: number | null = null;
  quoteDays: number | null = null;
  quoteMessage = '';

  accept(q: QuotationResponse): void {
    this.decide(q, 'accept');
  }

  reject(q: QuotationResponse): void {
    this.decide(q, 'reject');
  }

  submitQuote(): void {
    if (!this.quoteAmount || !this.quoteDays) {
      this.actionError.set('Indica el valor y los días estimados.');
      return;
    }
    this.busy.set('quote');
    this.actionError.set(null);
    this.requests
      .quote({ requestId: this.requestId(), amount: Number(this.quoteAmount), estimatedDays: Number(this.quoteDays), message: this.quoteMessage.trim() || undefined })
      .subscribe({
        next: (q) => {
          this.busy.set(null);
          this.myQuotation.set(q);
          this.notice.set('Enviamos tu cotización. Te avisaremos si la eligen.');
        },
        error: (failure) => {
          this.busy.set(null);
          this.actionError.set(errorMessage(failure, 'No pudimos enviar la cotización.'));
        }
      });
  }

  cancelRequest(): void {
    if (typeof window !== 'undefined' && !window.confirm('¿Cancelar esta solicitud? Los técnicos dejarán de verla.')) return;
    this.busy.set('cancel');
    this.requests.cancel(this.requestId()).subscribe({
      next: (r) => {
        this.busy.set(null);
        this.request.set(r);
      },
      error: (failure) => {
        this.busy.set(null);
        this.actionError.set(errorMessage(failure, 'No pudimos cancelar la solicitud.'));
      }
    });
  }

  onVisitCreated(visit: VisitResponse): void {
    this.proposing.set(false);
    this.visits.update((list) => [visit, ...(list ?? [])]);
  }

  onVisitChanged(visit: VisitResponse): void {
    this.visits.update((list) => (list ?? []).map((v) => (v.id === visit.id ? visit : v)));
  }

  onPaid(payment: PaymentDetail): void {
    this.payment.set(payment);
    if (payment.status === 'APPROVED') this.job.reload();
  }

  private decide(q: QuotationResponse, action: 'accept' | 'reject'): void {
    this.busy.set(q.id);
    this.actionError.set(null);
    const call: Observable<AcceptedQuotationResponse | QuotationResponse> =
      action === 'accept' ? this.requests.acceptQuotation(q.id) : this.requests.rejectQuotation(q.id);
    call.subscribe({
      next: (result) => {
        this.busy.set(null);
        this.quotations.reload();
        if (action === 'accept') {
          const accepted = result as AcceptedQuotationResponse;
          // Operación digital: si devuelve paymentId, registramos y navegamos al checkout
          if (accepted.paymentId) {
            this.knownPayments.remember(accepted.paymentId, {
              paymentId: accepted.paymentId,
              requestId: this.requestId(),
              propertyTitle: this.request.value()?.propertyName ?? undefined,
              amount: q.amount,
              status: 'PENDING',
              purpose: 'SERVICE'
            });
            void this.router.navigate(['/payments', accepted.paymentId]);
            return;
          }
          if (accepted.paymentMethod === 'CASH') {
            this.notice.set(`Elegiste a ${q.fixerName ?? 'el técnico'}. Operación histórica en efectivo: el trabajo quedó abierto.`);
          } else {
            this.notice.set(`Elegiste a ${q.fixerName ?? 'el técnico'}. Esperando confirmación de pago para abrir el trabajo.`);
          }
          this.request.reload();
        }
      },
      error: (failure) => {
        this.busy.set(null);
        this.actionError.set(errorMessage(failure, 'No pudimos registrar tu decisión.'));
      }
    });
  }
}
