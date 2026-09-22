import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { environment } from '../../../../../environments/environment';
import {
  ChatControllerService,
  MessageResponse,
  RepairRequestControllerService,
  RepairRequestStatus,
  Specialty,
  provideApi
} from '../../../../api/generated';
import { CurrentUserStore } from '../../../../core/auth/current-user.store';
import { RequestChatComponent } from './request-chat.component';

describe('RequestChatComponent (FR-UC-24: chat privado por solicitud asignada)', () => {
  let component: RequestChatComponent;
  let fixture: ComponentFixture<RequestChatComponent>;
  let httpTesting: HttpTestingController;
  let userStore: CurrentUserStore;

  const REQUEST_ID = 'req-1';
  const detailUrl = `${environment.apiOrigin}/requests/${REQUEST_ID}`;
  const messagesUrl = `${environment.apiOrigin}/requests/${REQUEST_ID}/messages`;

  const detailResponse = {
    requestId: REQUEST_ID,
    specialty: Specialty.Plumbing,
    title: 'Tubería rota en la cocina',
    description: 'Detalle...',
    photos: [],
    status: RepairRequestStatus.Assigned,
    assignedFixerUserId: 'fixer-1',
    createdAt: '2026-09-19T08:00:00Z'
  };

  const messageFromOwner: MessageResponse = {
    id: 'm-1',
    requestId: REQUEST_ID,
    senderUserId: 'owner-1',
    body: 'Hola, ¿cuándo puedes venir?',
    sentAt: '2026-09-20T10:00:00Z',
    notificationStatus: 'SENT'
  };

  const messageFromFixer: MessageResponse = {
    id: 'm-2',
    requestId: REQUEST_ID,
    senderUserId: 'fixer-1',
    body: 'Mañana a las 9am',
    sentAt: '2026-09-20T10:05:00Z',
    notificationStatus: 'SENT'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RequestChatComponent],
      providers: [
        ChatControllerService,
        RepairRequestControllerService,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApi(environment.apiOrigin),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'requestId' ? REQUEST_ID : null)
              }
            }
          }
        }
      ]
    });

    httpTesting = TestBed.inject(HttpTestingController);
    userStore = TestBed.inject(CurrentUserStore);
    userStore.setProfile({
      id: 'owner-1',
      email: 'owner@example.com',
      displayName: 'Propietario',
      status: 'ACTIVE',
      roles: ['OWNER']
    });
    fixture = TestBed.createComponent(RequestChatComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
    // El proyecto no tiene zone.js (Angular corre zoneless aquí), así que `fakeAsync`/`tick` de
    // @angular/core/testing no están disponibles para controlar el timer() del polling. Se usan
    // en su lugar los temporizadores falsos de Vitest, que sí funcionan porque RxJS resuelve
    // setTimeout/setInterval del global object en el momento en que corren, no al importar.
    vi.useRealTimers();
  });

  /**
   * Arranca el componente con `fixture.detectChanges()` en vez de llamar `ngOnInit()` a mano.
   * Es importante en este componente puntual (a diferencia del resto de specs del proyecto,
   * que sí llaman `ngOnInit()` directamente): Angular, incluso zoneless y sin `NgZone`, programa
   * su propio primer ciclo de detección de cambios para todo componente creado con
   * `TestBed.createComponent()`, con un timer real ajeno a cualquier `vi.useFakeTimers()`
   * activado después. En un test 100% síncrono ese timer real nunca alcanza a dispararse antes
   * de que termine el test, así que pasa desapercibido -- pero en este componente los tests SÍ
   * hacen `await` (para controlar el polling), y ese `await` le da al motor de JavaScript la
   * oportunidad de correr ese timer real pendiente, invocando `ngOnInit()` una segunda vez y
   * duplicando la petición GET /requests/{requestId}. Dejar que `detectChanges()` dispare el
   * primer ciclo real de Angular, en vez de invocar `ngOnInit()` manualmente además, evita esa
   * doble ejecución de raíz.
   */
  function start(): void {
    fixture.detectChanges();
  }

  it('debe cargar el contexto de la solicitud y el hilo inicial ordenado por fecha', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    start();

    httpTesting.expectOne(detailUrl).flush(detailResponse);

    await vi.advanceTimersByTimeAsync(0); // primer tick de timer(0, POLL_INTERVAL_MS)
    httpTesting.expectOne(messagesUrl).flush([messageFromFixer, messageFromOwner]);

    expect(component.request()?.title).toBe('Tubería rota en la cocina');
    expect(component.messages().map((m) => m.id)).toEqual(['m-1', 'm-2']); // reordenado por sentAt
    expect(component.loading()).toBe(false);
  });

  it('debe mezclar el siguiente tick de polling sin duplicar mensajes ya conocidos', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    start();
    httpTesting.expectOne(detailUrl).flush(detailResponse);

    await vi.advanceTimersByTimeAsync(0);
    httpTesting.expectOne(messagesUrl).flush([messageFromOwner]);
    expect(component.messages().length).toBe(1);

    const newMessage: MessageResponse = { ...messageFromFixer };
    await vi.advanceTimersByTimeAsync(5000);
    httpTesting.expectOne(messagesUrl).flush([messageFromOwner, newMessage]);

    expect(component.messages().map((m) => m.id)).toEqual(['m-1', 'm-2']);
    expect(component.messages().length).toBe(2);
  });

  it('debe traducir un 403 al cargar el hilo por primera vez como falta de acceso', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    start();
    httpTesting.expectOne(detailUrl).flush(detailResponse);

    await vi.advanceTimersByTimeAsync(0);
    httpTesting.expectOne(messagesUrl).flush({ code: 'ACCESS_DENIED' }, { status: 403, statusText: 'Forbidden' });

    expect(component.loadError()).toBe('No tienes acceso a esta conversación.');
  });

  it('un fallo transitorio de polling no debe borrar un hilo ya cargado', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    start();
    httpTesting.expectOne(detailUrl).flush(detailResponse);

    await vi.advanceTimersByTimeAsync(0);
    httpTesting.expectOne(messagesUrl).flush([messageFromOwner]);

    await vi.advanceTimersByTimeAsync(5000);
    httpTesting.expectOne(messagesUrl).flush(null, { status: 500, statusText: 'Server Error' });

    expect(component.messages().length).toBe(1);
    expect(component.pollError()).toContain('No se pudo actualizar');
  });

  it('debe enviar un mensaje y agregarlo de inmediato sin esperar el próximo tick', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    start();
    httpTesting.expectOne(detailUrl).flush(detailResponse);
    await vi.advanceTimersByTimeAsync(0);
    httpTesting.expectOne(messagesUrl).flush([messageFromOwner]);

    component.draft.set('Ya llegué al edificio');
    component.send();

    const sendReq = httpTesting.expectOne(messagesUrl);
    expect(sendReq.request.method).toBe('POST');
    expect(sendReq.request.body).toEqual({ body: 'Ya llegué al edificio' });

    const sentMessage: MessageResponse = {
      id: 'm-3',
      requestId: REQUEST_ID,
      senderUserId: 'owner-1',
      body: 'Ya llegué al edificio',
      sentAt: '2026-09-20T10:10:00Z',
      notificationStatus: 'SENT'
    };
    sendReq.flush(sentMessage);

    expect(component.messages().map((m) => m.id)).toContain('m-3');
    expect(component.draft()).toBe('');
    expect(component.sending()).toBe(false);
  });

  it('debe traducir el 409 de send() como solicitud sin técnico asignado', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    start();
    httpTesting.expectOne(detailUrl).flush(detailResponse);
    await vi.advanceTimersByTimeAsync(0);
    httpTesting.expectOne(messagesUrl).flush([]);

    component.draft.set('¿Sigues disponible?');
    component.send();

    httpTesting
      .expectOne(messagesUrl)
      .flush(null, { status: 409, statusText: 'Conflict' });

    expect(component.sendError()).toBe(
      'Esta solicitud todavía no tiene un técnico asignado; no puedes enviar mensajes hasta que se asigne uno.'
    );
    expect(component.sending()).toBe(false);
  });

  it('isMine debe comparar el remitente contra el id del usuario actual', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    start();
    httpTesting.expectOne(detailUrl).flush(detailResponse);
    await vi.advanceTimersByTimeAsync(0);
    httpTesting.expectOne(messagesUrl).flush([messageFromOwner, messageFromFixer]);

    expect(component.isMine(messageFromOwner)).toBe(true);
    expect(component.isMine(messageFromFixer)).toBe(false);
  });

  it('no debe permitir componer mensajes cuando el rol activo es PLATFORM_ADMIN', () => {
    userStore.setActiveRole('PLATFORM_ADMIN');
    expect(component.canSend()).toBe(false);
  });
});
