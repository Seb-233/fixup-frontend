import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { environment } from '../../../environments/environment';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { PaymentDetail } from '../../data/models';
import { PaymentPanelComponent } from './payment-panel.component';

const payment = (overrides: Partial<PaymentDetail> = {}): PaymentDetail => ({
  paymentId: 'pay-1',
  quotationId: 'q-1',
  requestId: 'r-1',
  amount: 185000,
  paymentMethod: 'TRANSFER',
  purpose: 'SERVICE',
  status: 'PENDING',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  completedAt: null,
  reference: 'FIX-PAY-001',
  ...overrides
});

describe('PaymentPanelComponent digital', () => {
  let backend: HttpTestingController;
  let userStore: CurrentUserStore;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [PaymentPanelComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    backend = TestBed.inject(HttpTestingController);
    userStore = TestBed.inject(CurrentUserStore);
    userStore.setProfile({
      id: 'owner-1',
      email: 'owner@fixup.com',
      displayName: 'Owner User',
      status: 'ACTIVE',
      roles: ['OWNER']
    });
  });

  afterEach(() => {
    // El panel consulta si Wompi está configurado; estas pruebas cubren la pasarela simulada.
    backend.match(`${environment.apiOrigin}/payments/wompi`).forEach((req) => req.flush({ enabled: false }));
    backend.verify();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('procesa un intento digital enviando instrumento, referencia y monto int64', () => {
    const fixture = TestBed.createComponent(PaymentPanelComponent);
    fixture.componentRef.setInput('payment', payment());
    fixture.componentRef.setInput('canPay', true);
    fixture.detectChanges();

    let paid: PaymentDetail | undefined;
    fixture.componentInstance.paid.subscribe((p) => (paid = p));

    fixture.componentInstance.open.set(true);
    fixture.componentInstance.instrument = 'SANDBOX_NEQUI';
    fixture.componentInstance.pay();

    const attemptReq = backend.expectOne(`${environment.apiOrigin}/payments/pay-1/attempts`);
    expect(attemptReq.request.method).toBe('POST');
    expect(attemptReq.request.headers.has('Idempotency-Key')).toBe(true);
    const body = JSON.parse(attemptReq.request.body);
    expect(body.instrument).toBe('SANDBOX_NEQUI');
    expect(body.amount).toBe(185000);
    expect(body.reference).toBe('FIX-PAY-001');

    attemptReq.flush(JSON.stringify({
      attemptId: 'att-1',
      paymentId: 'pay-1',
      status: 'APPROVED',
      attemptedAt: new Date().toISOString()
    }));

    // Inmediatamente después del intento consulta GET autoritativo del pago
    const getReq = backend.expectOne(`${environment.apiOrigin}/payments/pay-1`);
    expect(getReq.request.method).toBe('GET');
    getReq.flush(JSON.stringify(payment({ status: 'APPROVED', completedAt: new Date().toISOString() })));

    expect(paid?.status).toBe('APPROVED');
  });

  it('conserva la misma clave de idempotencia ante falla de red (status 0)', () => {
    const fixture = TestBed.createComponent(PaymentPanelComponent);
    fixture.componentRef.setInput('payment', payment());
    fixture.componentRef.setInput('canPay', true);
    fixture.detectChanges();

    fixture.componentInstance.open.set(true);
    fixture.componentInstance.instrument = 'SANDBOX_CARD';
    fixture.componentInstance.pay(false);

    const firstReq = backend.expectOne(`${environment.apiOrigin}/payments/pay-1/attempts`);
    const key1 = firstReq.request.headers.get('Idempotency-Key');
    expect(key1).toBeTruthy();

    // Simula fallo de red / timeout
    firstReq.error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
    fixture.detectChanges();

    expect(fixture.componentInstance.hasPendingRetry()).toBe(true);

    // Reintenta la operación pendiente
    fixture.componentInstance.pay(false);
    const retryReq = backend.expectOne(`${environment.apiOrigin}/payments/pay-1/attempts`);
    const key2 = retryReq.request.headers.get('Idempotency-Key');

    // Debe ser exactamente la misma clave
    expect(key2).toBe(key1);

    retryReq.flush(JSON.stringify({
      attemptId: 'att-2',
      paymentId: 'pay-1',
      status: 'APPROVED'
    }));

    const getReq = backend.expectOne(`${environment.apiOrigin}/payments/pay-1`);
    getReq.flush(JSON.stringify(payment({ status: 'APPROVED' })));
  });

  it('un intento forzado genera una clave de idempotencia diferente', () => {
    const fixture = TestBed.createComponent(PaymentPanelComponent);
    fixture.componentRef.setInput('payment', payment());
    fixture.componentRef.setInput('canPay', true);
    fixture.detectChanges();

    fixture.componentInstance.open.set(true);
    fixture.componentInstance.pay(false);

    const req1 = backend.expectOne(`${environment.apiOrigin}/payments/pay-1/attempts`);
    const key1 = req1.request.headers.get('Idempotency-Key');
    req1.flush(JSON.stringify({ attemptId: 'att-1', status: 'DECLINED', failureReason: 'Fondos insuficientes' }));

    const getReq1 = backend.expectOne(`${environment.apiOrigin}/payments/pay-1`);
    getReq1.flush(JSON.stringify(payment({ status: 'DECLINED' })));

    // Usuario decide hacer un nuevo intento genuino
    fixture.componentInstance.pay(true);
    const req2 = backend.expectOne(`${environment.apiOrigin}/payments/pay-1/attempts`);
    const key2 = req2.request.headers.get('Idempotency-Key');

    expect(key2).not.toBe(key1);
    req2.flush(JSON.stringify({ attemptId: 'att-2', status: 'APPROVED' }));
    const getReq2 = backend.expectOne(`${environment.apiOrigin}/payments/pay-1`);
    getReq2.flush(JSON.stringify(payment({ status: 'APPROVED' })));
  });

  it('un pago aprobado no ofrece pagar otra vez y bloquea nuevas operaciones', () => {
    const fixture = TestBed.createComponent(PaymentPanelComponent);
    fixture.componentRef.setInput('payment', payment({ status: 'APPROVED', completedAt: new Date().toISOString() }));
    fixture.componentRef.setInput('canPay', true);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('el trabajo ya quedó abierto');
    expect(text).not.toContain('Pagar $');

    fixture.componentInstance.pay();
    backend.expectNone(`${environment.apiOrigin}/payments/pay-1/attempts`);
  });

  it('quien no tiene autorización no ve botón para pagar', () => {
    const fixture = TestBed.createComponent(PaymentPanelComponent);
    fixture.componentRef.setInput('payment', payment());
    fixture.componentRef.setInput('canPay', false);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
  });

  it('soporta montos BigInt mayores a MAX_SAFE_INTEGER en la persistencia de sesión sin fallar', () => {
    const fixture = TestBed.createComponent(PaymentPanelComponent);
    const bigIntAmount = 9007199254740993n;
    fixture.componentRef.setInput('payment', payment({ amount: bigIntAmount as unknown as number }));
    fixture.componentRef.setInput('canPay', true);
    fixture.detectChanges();

    fixture.componentInstance.open.set(true);
    fixture.componentInstance.pay(false);

    const attemptReq = backend.expectOne(`${environment.apiOrigin}/payments/pay-1/attempts`);
    attemptReq.error(new ProgressEvent('error'), { status: 0 });
    fixture.detectChanges();

    const stored = sessionStorage.getItem('fixup_pending_attempt_owner-1_pay-1');
    expect(stored).toBeTruthy();
    expect(stored).toContain('9007199254740993');

    fixture.componentInstance.pay(false);
    const retryReq = backend.expectOne(`${environment.apiOrigin}/payments/pay-1/attempts`);
    expect(retryReq.request.headers.has('Idempotency-Key')).toBe(true);
    retryReq.flush(JSON.stringify({ attemptId: 'att-big', status: 'APPROVED' }));
    backend.expectOne(`${environment.apiOrigin}/payments/pay-1`).flush(JSON.stringify(payment({ status: 'APPROVED' })));
  });

  it('evita doble envío si pay() es invocado mientras una operación está en curso', () => {
    const fixture = TestBed.createComponent(PaymentPanelComponent);
    fixture.componentRef.setInput('payment', payment());
    fixture.componentRef.setInput('canPay', true);
    fixture.detectChanges();

    fixture.componentInstance.open.set(true);
    fixture.componentInstance.pay();

    const req1 = backend.expectOne(`${environment.apiOrigin}/payments/pay-1/attempts`);
    expect(fixture.componentInstance.busy()).toBe(true);

    fixture.componentInstance.pay();
    backend.expectNone(`${environment.apiOrigin}/payments/pay-1/attempts`);

    req1.flush(JSON.stringify({ attemptId: 'att-1', status: 'APPROVED' }));
    const getReq = backend.expectOne(`${environment.apiOrigin}/payments/pay-1`);
    getReq.flush(JSON.stringify(payment({ status: 'APPROVED' })));
    expect(fixture.componentInstance.busy()).toBe(false);
  });

  it('conserva la clave de idempotencia ante error 504 Gateway Timeout (resultado incierto)', () => {
    const fixture = TestBed.createComponent(PaymentPanelComponent);
    fixture.componentRef.setInput('payment', payment());
    fixture.componentRef.setInput('canPay', true);
    fixture.detectChanges();

    fixture.componentInstance.open.set(true);
    fixture.componentInstance.pay(false);

    const firstReq = backend.expectOne(`${environment.apiOrigin}/payments/pay-1/attempts`);
    const key1 = firstReq.request.headers.get('Idempotency-Key');
    expect(key1).toBeTruthy();

    firstReq.flush({ code: 'GATEWAY_TIMEOUT', message: 'Timeout' }, { status: 504, statusText: 'Gateway Timeout' });
    fixture.detectChanges();

    expect(fixture.componentInstance.hasPendingRetry()).toBe(true);

    fixture.componentInstance.pay(false);
    const retryReq = backend.expectOne(`${environment.apiOrigin}/payments/pay-1/attempts`);
    expect(retryReq.request.headers.get('Idempotency-Key')).toBe(key1);
    retryReq.flush(JSON.stringify({ attemptId: 'att-504', status: 'APPROVED' }));
    backend.expectOne(`${environment.apiOrigin}/payments/pay-1`).flush(JSON.stringify(payment({ status: 'APPROVED' })));
  });
});


describe('PaymentPanelComponent con Wompi (INT-01)', () => {
  let backend: HttpTestingController;
  const SANDBOX_CHECKOUT = 'https://checkout.wompi.co/p/?public-key=pub_test_abc123&currency=COP&amount-in-cents=18500000&reference=FIX-PAY-001-ABCD1234';

  const configure = (transactionId: string | null) => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [PaymentPanelComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(transactionId ? { id: transactionId } : {}) } }
        }
      ]
    });
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(CurrentUserStore).setProfile({
      id: 'owner-1', email: 'owner@fixup.com', displayName: 'Owner User', status: 'ACTIVE', roles: ['OWNER']
    });
  };

  const render = () => {
    const fixture = TestBed.createComponent(PaymentPanelComponent);
    fixture.componentRef.setInput('payment', payment());
    fixture.componentRef.setInput('canPay', true);
    fixture.detectChanges();
    return fixture;
  };

  afterEach(() => {
    vi.useRealTimers();
    backend.verify();
  });

  it('abre el checkout firmado de Wompi con la URL de retorno del pago', () => {
    configure(null);
    const fixture = render();
    const redirect = vi.spyOn(fixture.componentInstance, 'redirect').mockImplementation(() => undefined);

    fixture.componentInstance.startPayment();
    backend.expectOne(`${environment.apiOrigin}/payments/wompi`)
      .flush({ enabled: true, environment: 'sandbox' });
    fixture.detectChanges();
    const button = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((b) => b.textContent?.includes('Pagar con Wompi'));
    expect(button).toBeTruthy();

    button!.click();
    const checkout = backend.expectOne(`${environment.apiOrigin}/payments/pay-1/wompi/checkout`);
    expect(checkout.request.method).toBe('POST');
    expect(checkout.request.body.returnUrl).toBe(new URL('payments/pay-1', document.baseURI).toString());
    checkout.flush({
      paymentId: 'pay-1', reference: 'FIX-PAY-001-ABCD1234', amountInCents: 18500000, currency: 'COP',
      environment: 'sandbox', checkoutUrl: SANDBOX_CHECKOUT
    });

    expect(redirect).toHaveBeenCalledWith(SANDBOX_CHECKOUT);
  });

  it('sin llaves en el backend solo ofrece la pasarela simulada', () => {
    configure(null);
    const fixture = render();
    fixture.componentInstance.startPayment();
    backend.expectOne(`${environment.apiOrigin}/payments/wompi`).flush({ enabled: false });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Pagar con Wompi');
    expect(fixture.nativeElement.textContent).toContain('Confirmar pago simulado');
  });

  it('al volver de Wompi verifica la transacción, espera si está pendiente y refresca el pago', async () => {
    vi.useFakeTimers();
    configure('1234-1610641025-49201');
    let paid: PaymentDetail | undefined;
    const fixture = render();
    fixture.componentInstance.paid.subscribe((p) => (paid = p));

    backend.expectOne(`${environment.apiOrigin}/payments/wompi`).flush({ enabled: true, environment: 'sandbox' });
    const confirmUrl = `${environment.apiOrigin}/payments/pay-1/wompi/transactions/1234-1610641025-49201`;
    backend.expectOne(confirmUrl).flush({
      transactionId: '1234-1610641025-49201', transactionStatus: 'PENDING', paymentStatus: 'PENDING'
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Verificando el pago con Wompi');

    await vi.advanceTimersByTimeAsync(3000);
    backend.expectOne(confirmUrl).flush({
      transactionId: '1234-1610641025-49201', transactionStatus: 'APPROVED', paymentStatus: 'APPROVED',
      attempt: { attemptId: 'att-w', paymentId: 'pay-1', status: 'APPROVED', instrument: 'WOMPI',
        gatewayTransactionId: '1234-1610641025-49201' }
    });
    backend.expectOne(`${environment.apiOrigin}/payments/pay-1`)
      .flush(JSON.stringify(payment({ status: 'APPROVED', completedAt: new Date().toISOString() })));

    expect(paid?.status).toBe('APPROVED');
    expect(fixture.componentInstance.lastAttempt()?.instrument).toBe('WOMPI');
    expect(fixture.componentInstance.wompiChecking()).toBe(false);
  });

  it('si Wompi no responde muestra el error y permite verificar de nuevo', () => {
    configure('7-1-X');
    const fixture = render();
    backend.expectOne(`${environment.apiOrigin}/payments/wompi`).flush({ enabled: true, environment: 'sandbox' });
    backend.expectOne(`${environment.apiOrigin}/payments/pay-1/wompi/transactions/7-1-X`)
      .flush({ status: 503, code: 'PAYMENT_GATEWAY_UNAVAILABLE' }, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Wompi no respondió');
    expect(text).not.toContain('todavía no confirma');

    fixture.componentInstance.verifyWompi();
    backend.expectOne(`${environment.apiOrigin}/payments/pay-1/wompi/transactions/7-1-X`).flush({
      transactionId: '7-1-X', transactionStatus: 'APPROVED', paymentStatus: 'APPROVED'
    });
    backend.expectOne(`${environment.apiOrigin}/payments/pay-1`).flush(JSON.stringify(payment({ status: 'APPROVED' })));
    expect(fixture.componentInstance.wompiRetryId()).toBeNull();
  });


  it('si el backend no informa el sandbox no ofrece Wompi (ningún flujo puede iniciar un pago real)', () => {
    configure(null);
    const fixture = render();
    fixture.componentInstance.startPayment();
    backend.expectOne(`${environment.apiOrigin}/payments/wompi`).flush({ enabled: true, environment: 'production' });
    fixture.detectChanges();
    expect(fixture.componentInstance.wompi()?.enabled).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Pagar con Wompi');
    expect(fixture.nativeElement.textContent).toContain('Confirmar pago simulado');
  });

  it.each([
    ['production', { enabled: true, environment: 'production' }],
    ['un ambiente desconocido', { enabled: true, environment: 'staging' }],
    ['sin ambiente', { enabled: true }],
    ['apagado', { enabled: false, environment: 'sandbox' }]
  ])('con Wompi %s no aparece «Pagar con Wompi» ni se puede ejecutar', (_name, status) => {
    configure(null);
    const fixture = render();
    const redirect = vi.spyOn(fixture.componentInstance, 'redirect').mockImplementation(() => undefined);
    fixture.componentInstance.startPayment();
    backend.expectOne(`${environment.apiOrigin}/payments/wompi`).flush(status);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Pagar con Wompi');

    // Aunque algo llame al método directamente, no sale ninguna petición de checkout.
    fixture.componentInstance.payWithWompi();
    backend.expectNone(`${environment.apiOrigin}/payments/pay-1/wompi/checkout`);
    expect(redirect).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Confirmar pago simulado');
  });

  it.each([
    ['dice ser de producción', { environment: 'production', checkoutUrl: SANDBOX_CHECKOUT }],
    ['trae una llave pública de producción', { environment: 'sandbox', checkoutUrl: 'https://checkout.wompi.co/p/?public-key=pub_prod_abc123&reference=X' }],
    ['no trae llave pública', { environment: 'sandbox', checkoutUrl: 'https://checkout.wompi.co/p/?reference=X' }],
    ['apunta a otro sitio', { environment: 'sandbox', checkoutUrl: 'https://checkout.wompi.co.evil.example/p/?public-key=pub_test_abc123' }],
    ['no es una URL', { environment: 'sandbox', checkoutUrl: 'javascript:alert(1)' }]
  ])('si el checkout que devuelve el backend %s, el navegador no sale de FixUp', (_name, session) => {
    configure(null);
    const fixture = render();
    const redirect = vi.spyOn(fixture.componentInstance, 'redirect').mockImplementation(() => undefined);
    fixture.componentInstance.startPayment();
    backend.expectOne(`${environment.apiOrigin}/payments/wompi`).flush({ enabled: true, environment: 'sandbox' });

    fixture.componentInstance.payWithWompi();
    backend.expectOne(`${environment.apiOrigin}/payments/pay-1/wompi/checkout`).flush({
      paymentId: 'pay-1', reference: 'FIX-PAY-001-ABCD1234', amountInCents: 18500000, currency: 'COP', ...session
    });
    fixture.detectChanges();

    expect(redirect).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('no se abrió ningún pago');
    expect(fixture.componentInstance.busy()).toBe(false);
  });

  it.each([
    [503, 'PAYMENT_GATEWAY_UNAVAILABLE'],
    [409, 'PAYMENT_ALREADY_APPROVED'],
    [403, 'FORBIDDEN']
  ])('si abrir el checkout responde %i no navega, lo explica y deja reintentar', (status, code) => {
    configure(null);
    const fixture = render();
    const redirect = vi.spyOn(fixture.componentInstance, 'redirect').mockImplementation(() => undefined);
    fixture.componentInstance.startPayment();
    backend.expectOne(`${environment.apiOrigin}/payments/wompi`).flush({ enabled: true, environment: 'sandbox' });

    fixture.componentInstance.payWithWompi();
    backend.expectOne(`${environment.apiOrigin}/payments/pay-1/wompi/checkout`)
      .flush({ status, code }, { status, statusText: 'Error' });
    fixture.detectChanges();

    expect(redirect).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error()).toBeTruthy();
    expect(fixture.componentInstance.busy()).toBe(false);
  });

  it.each([
    [403, 'FORBIDDEN'],
    [404, 'PAYMENT_NOT_FOUND'],
    [409, 'WOMPI_PAYMENT_MISMATCH']
  ])('al volver con la sesión de otra persona (%i) no muestra el pago como aprobado', (status, code) => {
    configure('1234-1610641025-49201');
    let paid: PaymentDetail | undefined;
    const fixture = render();
    fixture.componentInstance.paid.subscribe((p) => (paid = p));
    backend.expectOne(`${environment.apiOrigin}/payments/wompi`).flush({ enabled: true, environment: 'sandbox' });
    backend.expectOne(`${environment.apiOrigin}/payments/pay-1/wompi/transactions/1234-1610641025-49201`)
      .flush({ status, code }, { status, statusText: 'Error' });
    fixture.detectChanges();

    // La interfaz no decide nada: sin confirmación del backend no hay aprobado ni se refresca el pago.
    backend.expectNone(`${environment.apiOrigin}/payments/pay-1`);
    expect(paid).toBeUndefined();
    expect(fixture.componentInstance.lastAttempt()).toBeNull();
    expect(fixture.componentInstance.error()).toBeTruthy();
    expect(fixture.componentInstance.wompiChecking()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Pago aprobado');
  });

  it('una respuesta APPROVED de Wompi con el pago todavía sin aprobar en FixUp no se muestra como aprobado', () => {
    configure('7-1-X');
    let paid: PaymentDetail | undefined;
    const fixture = render();
    fixture.componentInstance.paid.subscribe((p) => (paid = p));
    backend.expectOne(`${environment.apiOrigin}/payments/wompi`).flush({ enabled: true, environment: 'sandbox' });
    backend.expectOne(`${environment.apiOrigin}/payments/pay-1/wompi/transactions/7-1-X`).flush({
      transactionId: '7-1-X', transactionStatus: 'APPROVED', paymentStatus: 'PENDING'
    });
    // El estado que queda en pantalla es el que devuelve GET /payments/{id}, no el de la transacción.
    backend.expectOne(`${environment.apiOrigin}/payments/pay-1`).flush(JSON.stringify(payment({ status: 'PENDING' })));

    expect(paid?.status).toBe('PENDING');
    expect(fixture.componentInstance.lastFailure()).toBeTruthy();
  });

  it('un ?id= alterado no se envía al backend y se limpia de la URL', () => {
    configure('../../admin"><script>');
    const fixture = render();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('El enlace de regreso de Wompi no es válido');
    backend.expectNone((r) => r.url.includes('/wompi/transactions/'));
    backend.match(`${environment.apiOrigin}/payments/wompi`).forEach((r) => r.flush({ enabled: true, environment: 'sandbox' }));
  });

  it('el mismo regreso se verifica una sola vez aunque el pago se vuelva a pintar', () => {
    configure('5-1-ONCE');
    const fixture = render();
    backend.expectOne(`${environment.apiOrigin}/payments/wompi`).flush({ enabled: true, environment: 'sandbox' });
    const confirm = backend.expectOne(`${environment.apiOrigin}/payments/pay-1/wompi/transactions/5-1-ONCE`);
    fixture.componentRef.setInput('payment', payment({ amount: 185000 }));
    fixture.detectChanges();
    fixture.componentInstance.verifyWompi();
    backend.expectNone(`${environment.apiOrigin}/payments/pay-1/wompi/transactions/5-1-ONCE`);
    confirm.flush({ transactionId: '5-1-ONCE', transactionStatus: 'APPROVED', paymentStatus: 'APPROVED' });
    backend.expectOne(`${environment.apiOrigin}/payments/pay-1`).flush(JSON.stringify(payment({ status: 'APPROVED' })));
  });

  it('con PENDING persistente deja de consultar a los 10 intentos y ofrece verificar de nuevo', async () => {
    vi.useFakeTimers();
    configure('6-1-SLOW');
    const fixture = render();
    backend.expectOne(`${environment.apiOrigin}/payments/wompi`).flush({ enabled: true, environment: 'sandbox' });
    const url = `${environment.apiOrigin}/payments/pay-1/wompi/transactions/6-1-SLOW`;
    for (let round = 0; round < 10; round++) {
      backend.expectOne(url).flush({ transactionId: '6-1-SLOW', transactionStatus: 'PENDING', paymentStatus: 'PENDING' });
      await vi.advanceTimersByTimeAsync(3000);
    }
    backend.expectNone(url);
    fixture.detectChanges();
    expect(fixture.componentInstance.wompiChecking()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Wompi todavía no confirma la transacción 6-1-SLOW');
    expect(fixture.nativeElement.textContent).toContain('Verificar de nuevo');

    fixture.componentInstance.verifyWompi();
    backend.expectOne(url).flush({ transactionId: '6-1-SLOW', transactionStatus: 'APPROVED', paymentStatus: 'APPROVED' });
    backend.expectOne(`${environment.apiOrigin}/payments/pay-1`).flush(JSON.stringify(payment({ status: 'APPROVED' })));
  });

  it('al salir de la página corta el sondeo y descarta la respuesta tardía', async () => {
    vi.useFakeTimers();
    configure('8-1-LEAVE');
    const fixture = render();
    backend.expectOne(`${environment.apiOrigin}/payments/wompi`).flush({ enabled: true, environment: 'sandbox' });
    const url = `${environment.apiOrigin}/payments/pay-1/wompi/transactions/8-1-LEAVE`;
    backend.expectOne(url).flush({ transactionId: '8-1-LEAVE', transactionStatus: 'PENDING', paymentStatus: 'PENDING' });
    await vi.advanceTimersByTimeAsync(3000);
    const late = backend.expectOne(url);

    fixture.destroy();
    expect(late.cancelled).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    backend.expectNone(url);
  });

  it('muestra el motivo cuando Wompi rechaza la transacción', () => {
    configure('9-1-DECLINED');
    const fixture = render();
    backend.expectOne(`${environment.apiOrigin}/payments/wompi`).flush({ enabled: true, environment: 'sandbox' });
    backend.expectOne(`${environment.apiOrigin}/payments/pay-1/wompi/transactions/9-1-DECLINED`).flush({
      transactionId: '9-1-DECLINED', transactionStatus: 'DECLINED', paymentStatus: 'DECLINED',
      attempt: { attemptId: 'att-d', paymentId: 'pay-1', status: 'DECLINED', instrument: 'WOMPI',
        failureReason: 'Wompi rechazó la transacción: Fondos insuficientes' }
    });
    backend.expectOne(`${environment.apiOrigin}/payments/pay-1`).flush(JSON.stringify(payment({ status: 'DECLINED' })));
    fixture.componentRef.setInput('payment', payment({ status: 'DECLINED' }));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Wompi rechazó la transacción: Fondos insuficientes');
  });
});
