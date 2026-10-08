import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NotificationsStore } from './notifications.store';
import { NotificationsApiService, NotificationPage, NotificationItem } from './notifications-api.service';
import { environment } from '../../../environments/environment';

describe('NotificationsStore & NotificationsApiService', () => {
  let store: NotificationsStore;
  let apiService: NotificationsApiService;
  let httpTesting: HttpTestingController;

  const sampleNotification: NotificationItem = {
    id: 'notif-1',
    type: 'REQUEST_CREATED_URGENT',
    title: 'Solicitud urgente',
    body: 'Hay una solicitud urgente que requiere atención.',
    createdAt: '2026-10-06T10:00:00Z',
    read: false
  };

  const samplePage: NotificationPage = {
    content: [sampleNotification],
    totalElements: 1,
    totalPages: 1
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [NotificationsApiService, NotificationsStore]
    });

    store = TestBed.inject(NotificationsStore);
    apiService = TestBed.inject(NotificationsApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    store.ngOnDestroy();
    httpTesting.verify();
  });

  it('éxito actualiza el estado de notifications y unreadCount', () => {
    store.init();

    const listReq = httpTesting.expectOne((req) => req.url === `${environment.apiOrigin}/notifications/me`);
    expect(listReq.request.method).toBe('GET');
    listReq.flush(samplePage);

    const countReq = httpTesting.expectOne(`${environment.apiOrigin}/notifications/me/unread-count`);
    expect(countReq.request.method).toBe('GET');
    countReq.flush({ count: 1 });

    expect(store.loading()).toBe(false);
    expect(store.notifications()).toEqual([sampleNotification]);
    expect(store.unreadCount()).toBe(1);
    expect(store.error()).toBeNull();
  });

  it('error NO se convierte en éxito vacío silencioso: mantiene estado previo y expone error', () => {
    // Estado inicial simulado
    store.notifications.set([sampleNotification]);
    store.unreadCount.set(1);

    store.forceRefresh();
    expect(store.loading()).toBe(true);

    const listReq = httpTesting.expectOne((req) => req.url === `${environment.apiOrigin}/notifications/me`);
    const countReq = httpTesting.expectOne(`${environment.apiOrigin}/notifications/me/unread-count`);

    listReq.flush({ message: 'Internal Server Error' }, { status: 500, statusText: 'Server Error' });
    if (!countReq.cancelled) {
      countReq.flush({ count: 1 });
    }

    expect(store.loading()).toBe(false);
    // No debe silenciar el error borrando las notificaciones ni diciendo 0
    expect(store.notifications().length).toBe(1);
    expect(store.notifications()[0].id).toBe('notif-1');
    expect(store.error()).toBeTruthy();
  });

  it('mark-as-read fallido no se reporta como exitoso', () => {
    store.notifications.set([sampleNotification]);
    store.unreadCount.set(1);

    store.markOneRead('notif-1');

    const patchReq = httpTesting.expectOne(`${environment.apiOrigin}/notifications/notif-1/read`);
    expect(patchReq.request.method).toBe('PATCH');
    patchReq.flush({ message: 'Not found' }, { status: 404, statusText: 'Not Found' });

    // La notificación NO debe quedar marcada como leída ni disminuir unreadCount
    expect(store.notifications()[0].readAt).toBeUndefined();
    expect(store.unreadCount()).toBe(1);
    expect(store.error()).toBeTruthy();
  });

  it('NotificationsApiService propaga errores HTTP sin silenciarlos con catchError', () => {
    let errorReceived = false;

    apiService.list({}).subscribe({
      next: () => {
        expect.unreachable('No debía ser exitoso');
      },
      error: () => {
        errorReceived = true;
      }
    });

    const req = httpTesting.expectOne((r) => r.url === `${environment.apiOrigin}/notifications/me`);
    req.flush(null, { status: 500, statusText: 'Server Error' });

    expect(errorReceived).toBe(true);
  });
});
