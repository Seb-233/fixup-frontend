import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
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
  ...overrides
});

describe('PaymentPanelComponent', () => {
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PaymentPanelComponent], providers: [provideHttpClient(), provideHttpClientTesting()] });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('envía solo el resultado simulado; nunca datos de tarjeta ni de cuenta', () => {
    const fixture = TestBed.createComponent(PaymentPanelComponent);
    fixture.componentRef.setInput('payment', payment());
    fixture.componentRef.setInput('canPay', true);
    fixture.detectChanges();
    let paid: PaymentDetail | undefined;
    fixture.componentInstance.paid.subscribe((p) => (paid = p));

    fixture.componentInstance.outcome = 'DECLINED';
    fixture.componentInstance.pay();

    const request = backend.expectOne(`${environment.apiOrigin}/payments/pay-1/simulate`);
    expect(request.request.body).toEqual({ outcome: 'DECLINED' });
    request.flush(payment({ status: 'DECLINED' }));
    expect(paid?.status).toBe('DECLINED');
  });

  it('un pago aprobado no ofrece pagar otra vez', () => {
    const fixture = TestBed.createComponent(PaymentPanelComponent);
    fixture.componentRef.setInput('payment', payment({ status: 'APPROVED', completedAt: new Date().toISOString() }));
    fixture.componentRef.setInput('canPay', true);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('el trabajo ya quedó abierto');
    expect(text).not.toContain('Pagar $');
  });

  it('quien no paga ve el estado sin el botón', () => {
    const fixture = TestBed.createComponent(PaymentPanelComponent);
    fixture.componentRef.setInput('payment', payment());
    fixture.componentRef.setInput('canPay', false);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
  });
});
