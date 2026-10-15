import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NotificationItemComponent } from './notification-item.component';
import { NotificationItem } from '../../../../core/notifications/notifications-api.service';

describe('NotificationItemComponent', () => {
  let component: NotificationItemComponent;
  let fixture: ComponentFixture<NotificationItemComponent>;

  const chatNotification: NotificationItem = {
    id: 'notif-1',
    type: 'CHAT_MESSAGE_RECEIVED',
    title: 'Nuevo mensaje en solicitud',
    body: 'Hola, tengo una pregunta sobre el trabajo.',
    entityId: 'req-chat-123',
    createdAt: new Date().toISOString()
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationItemComponent],
      providers: [provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationItemComponent);
    component = fixture.componentInstance;
  });

  it('notificación CHAT_MESSAGE recibida aparece unread y resuelve la ruta de mensajes', () => {
    component.notification = { ...chatNotification, readAt: undefined };
    fixture.detectChanges();

    expect(component.targetRoute()).toBe('/requests/req-chat-123/messages');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.unread')).toBeTruthy();
    expect(compiled.textContent).toContain('NUEVA');
    expect(compiled.textContent).toContain('Nuevo mensaje en solicitud');
  });

  it('al hacer click emite markRead con el id de la notificación', () => {
    component.notification = { ...chatNotification, readAt: undefined };
    fixture.detectChanges();

    const markReadSpy = vi.fn();
    component.markRead.subscribe(markReadSpy);

    component.onClick();

    expect(markReadSpy).toHaveBeenCalledWith('notif-1');
  });

  it('si la notificación ya fue leída no emite markRead y no muestra badge NUEVA', () => {
    component.notification = {
      ...chatNotification,
      readAt: new Date().toISOString()
    };
    fixture.detectChanges();

    const markReadSpy = vi.fn();
    component.markRead.subscribe(markReadSpy);

    component.onClick();

    expect(markReadSpy).not.toHaveBeenCalled();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.unread')).toBeNull();
    expect(compiled.textContent).not.toContain('NUEVA');
  });

  it('notificación con push SKIPPED persiste visiblemente para el usuario', () => {
    component.notification = {
      ...chatNotification,
      data: { pushDelivery: 'SKIPPED' }
    };
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Nuevo mensaje en solicitud');
    expect(compiled.textContent).toContain('Hola, tengo una pregunta sobre el trabajo.');
  });
});
