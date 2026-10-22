import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Api } from './http';
import {
  CashSettlementDetail,
  EarningsResponse,
  ExpenseReport,
  FixerReviews,
  JobDetail,
  JobResponse,
  OwnerDebtDetail,
  PaymentDetail,
  PaymentSimulationOutcome,
  PayoutResponse,
  RatingResponse,
  VisitKind,
  VisitResponse
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

  /** FR-UC-05: un trabajo en efectivo se cierra con lo que el técnico recibió del cliente. */
  complete(jobId: string, note?: string, receivedAmount?: number): Observable<JobResponse> {
    return this.api.post(`/jobs/${jobId}/complete`, { note, receivedAmount });
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

  // Pagos del cliente (FR-UC-05): transferencia simulada, deudas de trabajos en efectivo e ingresos del técnico
  myPayments(): Observable<PaymentDetail[]> {
    return this.api.get('/payments/me');
  }

  payment(paymentId: string): Observable<PaymentDetail> {
    return this.api.get(`/payments/${paymentId}`);
  }

  simulate(paymentId: string, outcome: PaymentSimulationOutcome): Observable<PaymentDetail> {
    return this.api.post(`/payments/${paymentId}/simulate`, { outcome });
  }

  myDebts(): Observable<OwnerDebtDetail[]> {
    return this.api.get('/payments/me/debts');
  }

  payDebt(debtId: string): Observable<PaymentDetail> {
    return this.api.post(`/payments/debts/${debtId}/pay`);
  }

  cashSettlement(jobId: string): Observable<CashSettlementDetail> {
    return this.api.get(`/payments/cash-settlements/jobs/${jobId}`);
  }

  earnings(): Observable<EarningsResponse> {
    return this.api.get('/payments/me/earnings');
  }

  payouts(): Observable<PayoutResponse[]> {
    return this.api.get('/payments/me/payouts');
  }

  requestPayout(): Observable<PayoutResponse> {
    return this.api.post('/payments/me/payouts');
  }

  expenses(from: string, to: string, propertyId?: string): Observable<ExpenseReport> {
    return this.api.get('/analytics/expenses', { from, to, propertyId });
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
