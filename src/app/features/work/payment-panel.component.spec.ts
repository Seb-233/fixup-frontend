import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
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

