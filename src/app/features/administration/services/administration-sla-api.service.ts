import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { apiUrl } from '../../../api/api.routes';
import {
  RepairRequestStatusExt,
  UrgencyLevel
} from '../../requests/models/request-extensions';

export interface SlaBoardRequestItem {
  requestId: string;
  propertyId: string;
  propertyCity?: string | null;
  specialty: string;
  title: string;
  status: RepairRequestStatusExt;
  urgencyLevel: UrgencyLevel;
  slaDeadline: string;
  slaState: string;
  remainingMinutes: number;
  assignedFixerUserId?: string | null;
  lastEscalationNotifiedAt?: string | null;
  createdAt: string;
}

export interface ReassignFixerRequest {
  fixerUserId: string;
}

@Injectable({ providedIn: 'root' })
export class AdministrationSlaApiService {
  private readonly http = inject(HttpClient);

  getRequests(): Observable<SlaBoardRequestItem[]> {
    return this.http.get<SlaBoardRequestItem[]>(apiUrl('/administration/sla-board/requests'));
  }

  reassign(requestId: string, fixerUserId: string): Observable<void> {
    return this.http.post<void>(
      apiUrl(`/administration/sla-board/requests/${requestId}/reassign`),
      { fixerUserId }
    );
  }

  acknowledge(requestId: string): Observable<void> {
    return this.http.post<void>(
      apiUrl(`/administration/sla-board/requests/${requestId}/acknowledge`),
      {}
    );
  }
}
