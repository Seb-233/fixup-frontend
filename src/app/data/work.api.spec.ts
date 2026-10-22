import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { WorkApi } from './work.api';

// FR-UC-05: los contratos de pago que usa la interfaz contra el backend de Sebas.
describe('WorkApi pagos', () => {
  let api: WorkApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(WorkApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('la pasarela simulada recibe solo el resultado elegido', () => {
    api.simulate('pay-1', 'APPROVED').subscribe();
    const request = backend.expectOne(`${environment.apiOrigin}/payments/pay-1/simulate`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ outcome: 'APPROVED' });
    request.flush({});
  });

  it('pagar un saldo abre su transferencia sin cuerpo', () => {
    api.payDebt('debt-1').subscribe();
    const request = backend.expectOne(`${environment.apiOrigin}/payments/debts/debt-1/pay`);
    expect(request.request.method).toBe('POST');
    request.flush({});
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

  it('los pagos propios y las deudas se leen de sus rutas', () => {
    api.myPayments().subscribe();
    backend.expectOne(`${environment.apiOrigin}/payments/me`).flush([]);
    api.myDebts().subscribe();
    backend.expectOne(`${environment.apiOrigin}/payments/me/debts`).flush([]);
    api.cashSettlement('job-1').subscribe();
    backend.expectOne(`${environment.apiOrigin}/payments/cash-settlements/jobs/job-1`).flush({});
  });
});
