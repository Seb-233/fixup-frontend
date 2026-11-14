import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Api } from './http';
import { losslessParse, losslessStringify, toInt64Token } from './lossless-json';
import {
  AttemptRequest,
  CashSettlementDetail,
  EarningsResponse,
  ExpenseReport,
  FixerReviews,
  JobDetail,
  JobResponse,
  OwnerDebtDetail,
  PaymentAttemptResult,
  PaymentDetail,
  PaymentPageResponse,
  PaymentPurpose,
  PaymentStatus,
  PayoutResponse,
  RatingResponse,
  VisitKind,
  VisitResponse,
  WompiCheckoutSession,
  WompiStatus,
  WompiTransactionList,
  WompiTransactionResult
} from './models';

export interface RatingInput {
  jobId: string;
  score: number;
  punctuality?: number;
  quality?: number;
  cleanliness?: number;
  comment?: string;
}

// Trabajos, visitas, pagos y calificaciones: todo lo que pasa después de aceptar una cotización.
@Injectable({ providedIn: 'root' })
export class WorkApi {
  private readonly api = inject(Api);

  // Trabajos (FR-UC-19 y FR-UC-20)
  myJobs(): Observable<JobResponse[]> {
    return this.api.get('/jobs/me');
  }

  job(jobId: string): Observable<JobDetail> {
    return this.api.get(`/jobs/${jobId}`);
  }

  jobForRequest(requestId: string): Observable<JobDetail> {
    return this.api.get(`/jobs/for-request/${requestId}`);
  }

  schedule(jobId: string, scheduledFor: string, note?: string): Observable<JobResponse> {
    return this.api.post(`/jobs/${jobId}/schedule`, { scheduledFor, note });
  }

  start(jobId: string, note?: string): Observable<JobResponse> {
    return this.api.post(`/jobs/${jobId}/start`, { note });
  }

  addEvidence(jobId: string, mediaIds: string[], stage: string, caption?: string): Observable<unknown> {
    return this.api.post(`/jobs/${jobId}/evidence`, { mediaIds, stage, caption });
  }

  /** FR-UC-05: un trabajo en efectivo se cierra con lo recibido; uno por transferencia no envía receivedAmount. */
  complete(jobId: string, note?: string, receivedAmount?: number): Observable<JobResponse> {
    const payload: { note?: string; receivedAmount?: number } = {};
    if (note) payload.note = note;
    if (receivedAmount !== undefined) payload.receivedAmount = receivedAmount;
    return this.api.post(`/jobs/${jobId}/complete`, payload);
  }

  // Visitas técnicas
  myVisits(): Observable<VisitResponse[]> {
    return this.api.get('/visits/me');
  }

  visitsForRequest(requestId: string): Observable<VisitResponse[]> {
    return this.api.get('/visits', { requestId });
  }

  proposeVisit(body: {
    requestId: string;
    fixerUserId?: string;
    kind: VisitKind;
    scheduledAt: string;
    durationMinutes?: number;
    notes?: string;
  }): Observable<VisitResponse> {
    return this.api.post('/visits', body);
  }

  confirmVisit(visitId: string): Observable<VisitResponse> {
    return this.api.post(`/visits/${visitId}/confirm`);
  }

  rescheduleVisit(visitId: string, scheduledAt: string, durationMinutes?: number): Observable<VisitResponse> {
    return this.api.post(`/visits/${visitId}/reschedule`, { scheduledAt, durationMinutes });
  }

  cancelVisit(visitId: string, reason: string): Observable<VisitResponse> {
    return this.api.post(`/visits/${visitId}/cancel`, { reason });
  }

  completeVisit(
    visitId: string,
    outcome: string,
    checklist?: { position: number; result: string; note?: string }[]
  ): Observable<VisitResponse> {
    return this.api.post(`/visits/${visitId}/complete`, { outcome, checklist });
  }

  noShow(visitId: string): Observable<VisitResponse> {
    return this.api.post(`/visits/${visitId}/no-show`);
  }

  // Pagos del cliente (FR-UC-05 / INTEGRATION-04): recuperación paginada autoritativa, checkout digital e intentos con idempotencia
  myPayments(query?: { page?: number; size?: number; requestId?: string; status?: PaymentStatus; purpose?: PaymentPurpose }): Observable<PaymentPageResponse> {
    const params: Record<string, string | number | undefined> = {};
    if (query?.page !== undefined) params['page'] = query.page;
    if (query?.size !== undefined) params['size'] = query.size;
    if (query?.requestId) params['requestId'] = query.requestId;
    if (query?.status) params['status'] = query.status;
    if (query?.purpose) params['purpose'] = query.purpose;
    return this.api.getText('/payments/me', params).pipe(
      map(text => losslessParse<PaymentPageResponse>(text))
    );
  }

  payment(paymentId: string): Observable<PaymentDetail> {
    return this.api.getText(`/payments/${paymentId}`).pipe(
      map(text => losslessParse<PaymentDetail>(text))
    );
  }

  attempt(paymentId: string, idempotencyKey: string, body: AttemptRequest): Observable<PaymentAttemptResult> {
    const serializedBody = {
      ...body,
      amount: toInt64Token(body.amount)
    };
    const rawBody = losslessStringify(serializedBody);
    return this.api.postText(`/payments/${paymentId}/attempts`, rawBody, {
      idempotencyKey,
      headers: { 'Content-Type': 'application/json' }
    }).pipe(
      map(text => losslessParse<PaymentAttemptResult>(text))
    );
  }

  // INT-01: pasarela Wompi (Web Checkout). El backend firma el checkout y verifica el resultado.
  // JSON normal (no lossless): los montos en centavos de Wompi caben en un number, y así el error
  // llega como objeto con su code.
  wompiStatus(): Observable<WompiStatus> {
    return this.api.get<WompiStatus>('/payments/wompi');
  }

  wompiCheckout(paymentId: string, returnUrl: string): Observable<WompiCheckoutSession> {
    return this.api.post<WompiCheckoutSession>(`/payments/${paymentId}/wompi/checkout`, { returnUrl });
  }

  wompiConfirm(paymentId: string, transactionId: string): Observable<WompiTransactionResult> {
    return this.api.post<WompiTransactionResult>(
      `/payments/${paymentId}/wompi/transactions/${encodeURIComponent(transactionId)}`, null);
  }

  // Solo administración: transacciones del comercio leídas de Wompi con la llave privada.
  wompiTransactions(filter: { from?: string; until?: string; status?: string; page?: number; size?: number }):
      Observable<WompiTransactionList> {
    return this.api.get<WompiTransactionList>('/payments/wompi/transactions', filter);
  }

  myDebts(): Observable<OwnerDebtDetail[]> {
    return this.api.getText('/payments/me/debts').pipe(
      map(text => losslessParse<OwnerDebtDetail[]>(text))
    );
  }

  payDebt(debtId: string): Observable<PaymentDetail> {
    return this.api.postText(`/payments/debts/${debtId}/pay`, null).pipe(
      map(text => losslessParse<PaymentDetail>(text))
    );
  }

  cashSettlement(jobId: string): Observable<CashSettlementDetail> {
    return this.api.getText(`/payments/cash-settlements/jobs/${jobId}`).pipe(
      map(text => losslessParse<CashSettlementDetail>(text))
    );
  }

  earnings(): Observable<EarningsResponse> {
    return this.api.getText('/payments/me/earnings').pipe(
      map(text => losslessParse<EarningsResponse>(text))
    );
  }

  payouts(): Observable<PayoutResponse[]> {
    return this.api.getText('/payments/me/payouts').pipe(
      map(text => losslessParse<PayoutResponse[]>(text))
    );
  }

  requestPayout(idempotencyKey: string): Observable<PayoutResponse> {
    return this.api.postText('/payments/me/payouts', null, { idempotencyKey }).pipe(
      map(text => losslessParse<PayoutResponse>(text))
    );
  }

  expenses(from: string, to: string, propertyId?: string): Observable<ExpenseReport> {
    return this.api.getText('/analytics/expenses', { from, to, propertyId }).pipe(
      map(text => losslessParse<ExpenseReport>(text))
    );
  }

  expensesCsv(from: string, to: string, propertyId?: string): Observable<string> {
    return this.api.getText('/analytics/expenses/csv', { from, to, propertyId });
  }

  // Calificaciones
  rate(body: RatingInput): Observable<RatingResponse> {
    return this.api.post('/ratings', body);
  }

  ratingForJob(jobId: string): Observable<RatingResponse | null> {
    return this.api.get(`/ratings/jobs/${jobId}`);
  }

  fixerReviews(fixerUserId: string, limit = 20): Observable<FixerReviews> {
    return this.api.get(`/ratings/fixers/${fixerUserId}`, { limit });
  }
}
