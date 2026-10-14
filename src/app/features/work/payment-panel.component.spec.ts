import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { Charge } from '../../data/models';
import { PaymentPanelComponent } from './payment-panel.component';

const charge = (overrides: Partial<Charge> = {}): Charge => ({
  id: 'c-1',
  quotationId: 'q-1',
  requestId: 'r-1',
  propertyId: 'p-1',
  fixerUserId: 'f-1',
  specialty: 'PLUMBING',
  concept: 'Cambio de sifón',
  amount: 185000,
  reference: 'FXR-2026-0001',
  status: 'PENDING',
  method: null,
  gatewayTransactionId: null,
  failureReason: null,
  attempts: 0,
  createdAt: new Date().toISOString(),
  approvedAt: null,
  ...overrides
});

describe('PaymentPanelComponent', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PaymentPanelComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('envía referencia, valor, medio y escenario de prueba; nunca datos de tarjeta', () => {
    const fixture = TestBed.createComponent(PaymentPanelComponent);
    fixture.componentRef.setInput('charge', charge());
    fixture.componentRef.setInput('canPay', true);
    fixture.detectChanges();
    let paid: Charge | undefined;
    fixture.componentInstance.paid.subscribe((c) => (paid = c));

    fixture.componentInstance.method = 'SANDBOX_NEQUI';
    fixture.componentInstance.scenario = 'DECLINE_FUNDS';
    fixture.componentInstance.pay();

    const request = backend.expectOne(`${environment.apiOrigin}/payments/charges/c-1/pay`);
    expect(request.request.body).toEqual({ reference: 'FXR-2026-0001', amount: 185000, method: 'SANDBOX_NEQUI', scenario: 'DECLINE_FUNDS' });
    request.flush(charge({ status: 'DECLINED', failureReason: 'Fondos insuficientes en el medio de prueba', attempts: 1 }));
    expect(paid?.status).toBe('DECLINED');
  });

  it('un cobro aprobado no ofrece pagar otra vez', () => {
    const fixture = TestBed.createComponent(PaymentPanelComponent);
    fixture.componentRef.setInput('charge', charge({ status: 'APPROVED', method: 'SANDBOX_CARD', gatewayTransactionId: 'SBX-1', approvedAt: new Date().toISOString() }));
    fixture.componentRef.setInput('canPay', true);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('SBX-1');
    expect(text).not.toContain('Pagar $');
  });

  it('quien no paga ve el estado sin el botón', () => {
    const fixture = TestBed.createComponent(PaymentPanelComponent);
    fixture.componentRef.setInput('charge', charge());
    fixture.componentRef.setInput('canPay', false);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
  });
});
