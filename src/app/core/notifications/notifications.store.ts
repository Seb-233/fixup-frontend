import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { forkJoin, interval, Subject, Subscription, takeUntil } from 'rxjs';
import {
  NotificationItem,
  NotificationPage,
  NotificationType,
  NotificationsApiService
} from './notifications-api.service';

@Injectable({ providedIn: 'root' })
export class NotificationsStore implements OnDestroy {
  private readonly api = inject(NotificationsApiService);
  private readonly destroy$ = new Subject<void>();

  readonly notifications = signal<NotificationItem[]>([]);
  readonly unreadCount = signal<number>(0);
  readonly loading = signal(false);
  readonly filterType = signal<string>('ALL');
  readonly unreadOnly = signal(false);

  private currentPage = 0;
  private totalPages = 1;
  private pollingStarted = false;
  private pollingSub?: Subscription;

  init(): void {
    if (this.pollingStarted) {
      this.refresh();
      return;
    }
    this.pollingStarted = true;
    this.refresh();
    this.pollingSub = interval(30000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.refresh());
  }

  /**
   * Resetea el estado interno del store (usado al cambiar de usuario o al hacer logout).
   * Detiene polling limpio, limpia lista/notifications/unreadCount, deja ready para nuevo init().
   */
  resetForNewSession(): void {
    if (this.pollingSub instanceof Subscription) {
      this.pollingSub.unsubscribe();
    }
    this.pollingSub = undefined;
    this.pollingStarted = false;
    this.notifications.set([]);
    this.unreadCount.set(0);
    this.currentPage = 0;
    this.totalPages = 1;
    this.loading.set(false);
  }

  /**
   * Refresco forzado inmediato (p. ej., después de crear una solicitud urgente).
   * Público para que lo llamen componentes / otras stores.
   */
  forceRefresh(): void {
    this.refresh();
  }

  ngOnDestroy(): void {
    if (this.pollingSub instanceof Subscription) {
      this.pollingSub.unsubscribe();
    }
    this.pollingSub = undefined;
    this.destroy$.next();
    this.destroy$.complete();
    this.pollingStarted = false;
  }

  private refresh(): void {
    this.loading.set(true);
    forkJoin({
      page: this.api.list({ page: 0, size: 50 }),
      count: this.api.unreadCount()
    }).subscribe({
      next: ({ page, count }) => {
        this.notifications.set(page.content);
        this.currentPage = 0;
        this.totalPages = page.totalPages;
        this.unreadCount.set(count.count);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  loadMore(): void {
    if (this.loading() || this.currentPage >= this.totalPages - 1) return;
    this.loading.set(true);
    const nextPage = this.currentPage + 1;
    this.api.list({ page: nextPage, size: 50 }).subscribe({
      next: (page: NotificationPage) => {
        this.notifications.update((prev) => [...prev, ...page.content]);
        this.currentPage = nextPage;
        this.totalPages = page.totalPages;
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  setFilter(type: string): void {
    this.filterType.set(type);
  }

  toggleUnreadOnly(): void {
    this.unreadOnly.update((v) => !v);
  }

  markOneRead(id: string): void {
    const target = this.notifications().find((n) => n.id === id);
    if (!target || target.readAt) return;
    this.api.markAsRead(id).subscribe(() => {
      this.notifications.update((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      this.unreadCount.update((c) => Math.max(0, c - 1));
    });
  }

  markAllRead(): void {
    if (this.unreadCount() === 0) return;
    this.api.markAllAsRead().subscribe(() => {
      const now = new Date().toISOString();
      this.notifications.update((prev) =>
        prev.map((n) => (n.readAt ? n : { ...n, readAt: now }))
      );
      this.unreadCount.set(0);
    });
  }
}
