import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, timer, map, catchError, switchMap } from 'rxjs';
import { apiUrl } from '../../api/api.routes';

export type NotificationType =
  | 'REQUEST_CREATED_URGENT'
  | 'REQUEST_SLA_WARNING'
  | 'REQUEST_SLA_BREACHED'
  | 'QUOTATION_RECEIVED'
  | 'QUOTATION_ACCEPTED'
  | 'JOB_ASSIGNED'
  | 'PROPERTY_PUBLISHED'
  | 'PROPERTY_BULK_FINISHED'
  | 'CONTRACT_CREATED'
  | 'CONTRACT_EXPIRING_30D'
  | 'CONTRACT_EXPIRING_7D'
  | 'CONTRACT_EXPIRED'
  | 'CHAT_MESSAGE_RECEIVED';

export interface NotificationItem {
  id: string;
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body: string;
  navigateTo?: string;
  entityId?: string;
  entityType?: string;
  data?: Record<string, string>;
  readAt?: string;
  createdAt: string;
}

export interface NotificationPage {
  content: NotificationItem[];
  totalElements: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly http = inject(HttpClient);

  list(params: {
    page?: number;
    size?: number;
    type?: string;
    unreadOnly?: boolean;
  }): Observable<NotificationPage> {
    let httpParams = new HttpParams();
    if (params.page !== undefined) httpParams = httpParams.set('page', params.page.toString());
    if (params.size !== undefined) httpParams = httpParams.set('size', params.size.toString());
    if (params.type) httpParams = httpParams.set('type', params.type);
    if (params.unreadOnly !== undefined) httpParams = httpParams.set('unreadOnly', params.unreadOnly.toString());

    return this.http.get<NotificationPage>(apiUrl('/notifications/me'), { params: httpParams }).pipe(
      catchError(() =>
        timer(400).pipe(
          map(() => ({ content: [], totalElements: 0, totalPages: 0 }))
        )
      )
    );
  }

  markAsRead(id: string): Observable<void> {
    return this.http.patch<void>(apiUrl(`/notifications/${id}/read`), {}).pipe(
      catchError(() => of(undefined))
    );
  }

  markAllAsRead(): Observable<void> {
    return this.http.patch<void>(apiUrl('/notifications/read-all'), {}).pipe(
      catchError(() => of(undefined))
    );
  }

  unreadCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>(apiUrl('/notifications/me/unread-count')).pipe(
      catchError(() => of({ count: 0 }))
    );
  }
}
