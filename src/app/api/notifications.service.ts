import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap, switchMap, interval, startWith } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  entityId: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

export type NotificationType =
  | 'REPAIR_REQUEST_OPENED'
  | 'REPAIR_REQUEST_ASSIGNED'
  | 'REPAIR_REQUEST_STARTED'
  | 'REPAIR_REQUEST_COMPLETED'
  | 'REPAIR_REQUEST_CANCELLED'
  | 'REPAIR_REQUEST_ON_HOLD'
  | 'REPAIR_REQUEST_RESUMED'
  | 'REPAIR_REQUEST_URGENCY_CHANGED'
  | 'SLA_WARNING'
  | 'SLA_BREACH'
  | 'NEW_QUOTATION'
  | 'QUOTATION_ACCEPTED'
  | 'QUOTATION_REJECTED'
  | 'CONTRACT_CREATED'
  | 'CONTRACT_SIGNED'
  | 'CONTRACT_RENEWED'
  | 'CONTRACT_TERMINATED'
  | 'CONTRACT_CANCELLED'
  | 'FIXER_VERIFICATION_SUBMITTED'
  | 'FIXER_VERIFICATION_APPROVED'
  | 'FIXER_VERIFICATION_REJECTED'
  | 'PORTFOLIO_PIECE_APPROVED'
  | 'PORTFOLIO_PIECE_REJECTED'
  | 'PROPERTY_PUBLISHED'
  | 'PROPERTY_BATCH_PUBLISHED'
  | 'PROPERTY_UPDATED'
  | 'PROPERTY_UNLISTED'
  | 'GENERAL';

export interface UnreadCountResponse {
  count: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly apiOrigin = environment.apiOrigin;

  private readonly _unread = signal<number>(0);
  readonly unreadCount = this._unread.asReadonly();

  refreshCount(): Observable<number> {
    return this.http
      .get<UnreadCountResponse>(`${this.apiOrigin}/notifications/unread-count`)
      .pipe(
        map((r) => r.count),
        tap((count) => this._unread.set(count))
      );
  }

  startPolling(intervalMs = 60000) {
    return interval(intervalMs).pipe(
      startWith(0),
      switchMap(() => this.refreshCount())
    );
  }

  list(params?: { includeRead?: boolean; limit?: number }): Observable<Notification[]> {
    const query = new URLSearchParams();
    if (params?.includeRead !== undefined)
      query.set('includeRead', String(params.includeRead));
    if (params?.limit !== undefined) query.set('limit', String(params.limit));
    const qs = query.toString();
    return this.http.get<Notification[]>(
      `${this.apiOrigin}/notifications${qs ? `?${qs}` : ''}`
    );
  }

  markAsRead(notificationId: string): Observable<void> {
    return this.http
      .post<void>(`${this.apiOrigin}/notifications/${notificationId}/read`, {})
      .pipe(tap(() => this._unread.update((c) => Math.max(0, c - 1))));
  }

  markAllAsRead(): Observable<void> {
    return this.http
      .post<void>(`${this.apiOrigin}/notifications/read-all`, {})
      .pipe(tap(() => this._unread.set(0)));
  }
}
