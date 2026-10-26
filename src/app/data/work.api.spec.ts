import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { PaymentAttemptResult, PaymentDetail, PaymentPageResponse, PayoutResponse } from './models';
import { WorkApi } from './work.api';

// FR-UC-05: los contratos de pago digitales que usa la interfaz contra el backend de FixUp.
describe('WorkApi pagos digitales', () => {
  let api: WorkApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(WorkApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('el intento digital envía Idempotency-Key y cuerpo JSON con token numérico int64', () => {
    let result: PaymentAttemptResult | undefined;
    api.attempt('pay-1', 'key-uuid-123', {
      instrument: 'SANDBOX_CARD',
      amount: 150000,
      reference: 'FIX-REQ-001'
    }).subscribe(res => (result = res));

    const request = backend.expectOne(`${environment.apiOrigin}/payments/pay-1/attempts`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('key-uuid-123');
    expect(request.request.headers.get('Content-Type')).toBe('application/json');
    expect(request.request.body).toBe('{"instrument":"SANDBOX_CARD","amount":150000,"reference":"FIX-REQ-001"}');

    request.flush(JSON.stringify({
      attemptId: 'att-1',
      paymentId: 'pay-1',
      status: 'APPROVED',
      attemptedAt: '2026-10-24T12:00:00Z'
    }));

    expect(result?.status).toBe('APPROVED');
    expect(result?.attemptId).toBe('att-1');
  });

  it('la consulta de un pago recupera el detalle exacto sin truncar importes int64', () => {
    let detail: (PaymentDetail & { amount: bigint | number }) | undefined;
    api.payment('pay-1').subscribe(res => (detail = res as unknown as (PaymentDetail & { amount: bigint | number })));

    const request = backend.expectOne(`${environment.apiOrigin}/payments/pay-1`);
    expect(request.request.method).toBe('GET');

    request.flush('{"paymentId":"pay-1","reference":"FIX-1","amount":9007199254740993,"status":"PENDING","attempts":[]}');

    expect(typeof detail?.amount).toBe('bigint');
    expect(detail?.amount.toString()).toBe('9007199254740993');
  });

  it('el retiro digital envía Idempotency-Key y POST sin cuerpo', () => {
    let payout: PayoutResponse | undefined;
    api.requestPayout('payout-uuid-456').subscribe(res => (payout = res));

    const request = backend.expectOne(`${environment.apiOrigin}/payments/me/payouts`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('payout-uuid-456');
    expect(request.request.body).toBeNull();

    request.flush(JSON.stringify({
      id: 'payout-1',
      amount: 250000,
      earningCount: 1,
      status: 'TRANSFERRED',
      requestedAt: '2026-10-24T12:00:00Z',
      detailStatus: 'AVAILABLE',
      earnings: []
    }));

    expect(payout?.id).toBe('payout-1');
    expect(payout?.status).toBe('TRANSFERRED');
  });

  it('pagar un saldo abre su transferencia sin cuerpo', () => {
    api.payDebt('debt-1').subscribe();
    const request = backend.expectOne(`${environment.apiOrigin}/payments/debts/debt-1/pay`);
    expect(request.request.method).toBe('POST');
    request.flush(JSON.stringify({ paymentId: 'pay-from-debt', status: 'PENDING' }));
  });

  it('un trabajo en efectivo se cierra con lo recibido; uno por transferencia sin monto', () => {
    api.complete('job-1', 'Listo', 60000).subscribe();
    const cash = backend.expectOne(`${environment.apiOrigin}/jobs/job-1/complete`);
    expect(cash.request.body).toEqual({ note: 'Listo', receivedAmount: 60000 });
    cash.flush({});

    api.complete('job-2').subscribe();
    const transfer = backend.expectOne(`${environment.apiOrigin}/jobs/job-2/complete`);
    expect(transfer.request.body).toEqual({ note: undefined, receivedAmount: undefined });
    transfer.flush({});
  });

  it('las deudas y liquidaciones se leen de sus rutas', () => {
    api.myDebts().subscribe();
    backend.expectOne(`${environment.apiOrigin}/payments/me/debts`).flush(JSON.stringify([]));
    api.cashSettlement('job-1').subscribe();
    backend.expectOne(`${environment.apiOrigin}/payments/cash-settlements/jobs/job-1`).flush(JSON.stringify({}));
  });

  it('la consulta paginada de pagos (GET /payments/me) envía parámetros de consulta y preserva importes int64', () => {
    let page: PaymentPageResponse | undefined;
    api.myPayments({ page: 1, size: 10, status: 'APPROVED' }).subscribe(res => (page = res));

    const request = backend.expectOne(req => req.url === `${environment.apiOrigin}/payments/me`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('size')).toBe('10');
    expect(request.request.params.get('status')).toBe('APPROVED');

    request.flush(JSON.stringify({
      items: [{
        paymentId: 'pay-1',
        quotationId: 'quote-1',
        requestId: 'req-1',
        amount: 250000,
        paymentMethod: 'TRANSFER',
        purpose: 'SERVICE',
        status: 'APPROVED',
        createdAt: '2026-10-24T12:00:00Z',
        updatedAt: '2026-10-24T12:00:00Z',
        reference: 'FXR-1'
      }],
      page: 1,
      size: 10,
      hasMore: false
    }));

    expect(page?.items.length).toBe(1);
    expect(page?.items[0].paymentId).toBe('pay-1');
    expect(page?.hasMore).toBe(false);
  });
});
