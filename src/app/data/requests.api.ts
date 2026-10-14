import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Api } from './http';
import {
  BoardItem,
  Candidate,
  MessageResponse,
  OpenRequestSummaryResponse,
  QuotationResponse,
  ReportablePropertyResponse,
  RequestDetailResponse,
  UrgencyLevel
} from './models';

export interface NewRequest {
  propertyId: string;
  title: string;
  description: string;
  mediaIds: string[];
  urgencyLevel: UrgencyLevel;
}

@Injectable({ providedIn: 'root' })
export class RequestsApi {
  private readonly api = inject(Api);

  mine(): Observable<RequestDetailResponse[]> {
    return this.api.get('/requests/me');
  }

  open(): Observable<OpenRequestSummaryResponse[]> {
    return this.api.get('/requests/open');
  }

  get(requestId: string): Observable<RequestDetailResponse> {
    return this.api.get(`/requests/${requestId}`);
  }

  reportableProperties(): Observable<ReportablePropertyResponse[]> {
    return this.api.get('/requests/reportable-properties');
  }

  create(body: NewRequest): Observable<RequestDetailResponse> {
    return this.api.post('/requests', body);
  }

  cancel(requestId: string): Observable<RequestDetailResponse> {
    return this.api.post(`/requests/${requestId}/cancel`);
  }

  messages(requestId: string): Observable<MessageResponse[]> {
    return this.api.get(`/requests/${requestId}/messages`);
  }

  sendMessage(requestId: string, body: string): Observable<MessageResponse> {
    return this.api.post(`/requests/${requestId}/messages`, { body });
  }

  // Cotizaciones (FR-UC-18)
  quotations(requestId: string): Observable<QuotationResponse[]> {
    return this.api.get(`/quotations/for-request/${requestId}`);
  }

  myQuotations(): Observable<QuotationResponse[]> {
    return this.api.get('/quotations/me');
  }

  quote(body: { requestId: string; amount: number; estimatedDays: number; message?: string }): Observable<QuotationResponse> {
    return this.api.post('/quotations', body);
  }

  acceptQuotation(quotationId: string): Observable<QuotationResponse> {
    return this.api.post(`/quotations/${quotationId}/accept`);
  }

  rejectQuotation(quotationId: string): Observable<QuotationResponse> {
    return this.api.post(`/quotations/${quotationId}/reject`);
  }

  // Gestión de mantenimiento de la inmobiliaria
  board(): Observable<BoardItem[]> {
    return this.api.get('/management/requests');
  }

  candidates(requestId: string): Observable<Candidate[]> {
    return this.api.get(`/management/requests/${requestId}/candidates`);
  }

  invite(requestId: string, fixerUserIds: string[], note?: string): Observable<{ invitedFixerUserIds: string[] }> {
    return this.api.post(`/management/requests/${requestId}/invitations`, { fixerUserIds, note });
  }
}
