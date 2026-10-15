import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import {
  PaymentControllerService,
  PaymentDetail,
  PaymentMethod,
  PaymentPurpose,
  PaymentSimulationOutcome,
  PaymentStatus,
  provideApi
} from '../../../../api/generated';
import { PaymentCheckoutComponent } from './payment-checkout.component';

describe('PaymentCheckoutComponent (Pasarela de pagos simulada)', () => {
  let component: PaymentCheckoutComponent;
  let httpTesting: HttpTestingController;

  const mockPaymentService: PaymentDetail = {
    paymentId: 'pay-service-123',
    quotationId: 'quot-123',
    requestId: 'req-123',
    amount: 150000,
    status: PaymentStatus.Pending,
    purpose: PaymentPurpose.Service,
    paymentMethod: PaymentMethod.Transfer,
    createdAt: '2026-10-15T10:00:00Z',
    updatedAt: '2026-10-15T10:00:00Z'
  };

  const mockPaymentDebt: PaymentDetail = {
    paymentId: 'pay-debt-456',
    quotationId: 'quot-456',
    requestId: 'req-456',
    amount: 50000,
    status: PaymentStatus.Pending,
    purpose: PaymentPurpose.OutstandingBalance,
    paymentMethod: PaymentMethod.Transfer,
    createdAt: '2026-10-15T10:00:00Z',
    updatedAt: '2026-10-15T10:00:00Z'
  };

  const setupTestBed = (paymentId: string) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PaymentCheckoutComponent],
      providers: [
        PaymentControllerService,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApi(environment.apiOrigin),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'paymentId' ? paymentId : null)
              }
            }
          }
        }
      ]
    });

    httpTesting = TestBed.inject(HttpTestingController);
    component = TestBed.createComponent(PaymentCheckoutComponent).componentInstance;
  };

  afterEach(() => {
    httpTesting.verify();
    TestBed.resetTestingModule();
  });

  it('debe cargar la información inicial del pago por GET /payments/:paymentId', () => {
    setupTestBed('pay-service-123');
    component.ngOnInit();

    expect(component.loading()).toBe(true);

    const getReq = httpTesting.expectOne(`${environment.apiOrigin}/payments/pay-service-123`);
    expect(getReq.request.method).toBe('GET');
    getReq.flush(mockPaymentService);

    expect(component.loading()).toBe(false);
    expect(component.payment()?.paymentId).toBe('pay-service-123');
    expect(component.payment()?.status).toBe(PaymentStatus.Pending);
    expect(component.payment()?.amount).toBe(150000);
    expect(component.payment()?.purpose).toBe(PaymentPurpose.Service);
  });

  it('debe simular resultado PENDING y reconsultar el estado autoritativo en backend', () => {
    setupTestBed('pay-service-123');
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/payments/pay-service-123`).flush(mockPaymentService);

    component.simulateOutcome(PaymentSimulationOutcome.Pending);
    expect(component.simulating()).toBe(true);

    const postReq = httpTesting.expectOne(`${environment.apiOrigin}/payments/pay-service-123/simulate`);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({ outcome: PaymentSimulationOutcome.Pending });
    postReq.flush({
      ...mockPaymentService,
      status: PaymentStatus.Pending
    });

    // Reconsulta autoritativa GET detail
    const getRefetch = httpTesting.expectOne(`${environment.apiOrigin}/payments/pay-service-123`);
    expect(getRefetch.request.method).toBe('GET');
    getRefetch.flush({
      ...mockPaymentService,
      status: PaymentStatus.Pending
    });

    expect(component.simulating()).toBe(false);
    expect(component.payment()?.status).toBe(PaymentStatus.Pending);
    expect(component.simulationError()).toBeNull();
  });

  it('debe simular resultado DECLINED y permitir reintento posterior', () => {
    setupTestBed('pay-service-123');
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/payments/pay-service-123`).flush(mockPaymentService);

    component.simulateOutcome(PaymentSimulationOutcome.Declined);

    const postReq = httpTesting.expectOne(`${environment.apiOrigin}/payments/pay-service-123/simulate`);
    postReq.flush({ ...mockPaymentService, status: PaymentStatus.Declined });

    const getRefetch = httpTesting.expectOne(`${environment.apiOrigin}/payments/pay-service-123`);
    getRefetch.flush({ ...mockPaymentService, status: PaymentStatus.Declined });

    expect(component.payment()?.status).toBe(PaymentStatus.Declined);

    // Reintento: DECLINED -> APPROVED sobre el mismo paymentId
    component.simulateOutcome(PaymentSimulationOutcome.Approved);

    const retryPost = httpTesting.expectOne(`${environment.apiOrigin}/payments/pay-service-123/simulate`);
    expect(retryPost.request.body).toEqual({ outcome: PaymentSimulationOutcome.Approved });
    retryPost.flush({ ...mockPaymentService, status: PaymentStatus.Approved });

    const retryGet = httpTesting.expectOne(`${environment.apiOrigin}/payments/pay-service-123`);
    retryGet.flush({ ...mockPaymentService, status: PaymentStatus.Approved });

    expect(component.payment()?.status).toBe(PaymentStatus.Approved);
  });

  it('debe simular resultado ERROR y permitir reintento posterior hacia APPROVED', () => {
    setupTestBed('pay-service-123');
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/payments/pay-service-123`).flush(mockPaymentService);

    component.simulateOutcome(PaymentSimulationOutcome.Error);

    const postReq = httpTesting.expectOne(`${environment.apiOrigin}/payments/pay-service-123/simulate`);
    postReq.flush({ ...mockPaymentService, status: PaymentStatus.Error });

    const getRefetch = httpTesting.expectOne(`${environment.apiOrigin}/payments/pay-service-123`);
    getRefetch.flush({ ...mockPaymentService, status: PaymentStatus.Error });

    expect(component.payment()?.status).toBe(PaymentStatus.Error);

    // Reintento: ERROR -> APPROVED
    component.simulateOutcome(PaymentSimulationOutcome.Approved);

    const retryPost = httpTesting.expectOne(`${environment.apiOrigin}/payments/pay-service-123/simulate`);
    retryPost.flush({ ...mockPaymentService, status: PaymentStatus.Approved });

    const retryGet = httpTesting.expectOne(`${environment.apiOrigin}/payments/pay-service-123`);
    retryGet.flush({ ...mockPaymentService, status: PaymentStatus.Approved });

    expect(component.payment()?.status).toBe(PaymentStatus.Approved);
  });

  it('debe manejar simulación APPROVED para SERVICE deshabilitando transiciones inválidas posteriores', () => {
    setupTestBed('pay-service-123');
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/payments/pay-service-123`).flush(mockPaymentService);

    component.simulateOutcome(PaymentSimulationOutcome.Approved);

    const postReq = httpTesting.expectOne(`${environment.apiOrigin}/payments/pay-service-123/simulate`);
    postReq.flush({ ...mockPaymentService, status: PaymentStatus.Approved });

    const getRefetch = httpTesting.expectOne(`${environment.apiOrigin}/payments/pay-service-123`);
    getRefetch.flush({ ...mockPaymentService, status: PaymentStatus.Approved });

    expect(component.payment()?.status).toBe(PaymentStatus.Approved);
    expect(component.statusLabel(component.payment()?.status)).toBe('Aprobado');
    expect(component.purposeLabel(component.payment()?.purpose)).toBe('Servicio de reparación');
  });

  it('debe soportar la misma interfaz de pasarela para OUTSTANDING_BALANCE de deuda', () => {
    setupTestBed('pay-debt-456');
    component.ngOnInit();

    const getReq = httpTesting.expectOne(`${environment.apiOrigin}/payments/pay-debt-456`);
    getReq.flush(mockPaymentDebt);

    expect(component.payment()?.purpose).toBe(PaymentPurpose.OutstandingBalance);
    expect(component.purposeLabel(component.payment()?.purpose)).toContain('Saldo pendiente');

    component.simulateOutcome(PaymentSimulationOutcome.Approved);

    const postReq = httpTesting.expectOne(`${environment.apiOrigin}/payments/pay-debt-456/simulate`);
    postReq.flush({ ...mockPaymentDebt, status: PaymentStatus.Approved });

    const getRefetch = httpTesting.expectOne(`${environment.apiOrigin}/payments/pay-debt-456`);
    getRefetch.flush({ ...mockPaymentDebt, status: PaymentStatus.Approved });

    expect(component.payment()?.status).toBe(PaymentStatus.Approved);
  });

  it('debe manejar error 409 al intentar simular en un pago que ya no admite transiciones', () => {
    setupTestBed('pay-service-123');
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/payments/pay-service-123`).flush(mockPaymentService);

    component.simulateOutcome(PaymentSimulationOutcome.Approved);

    const postReq = httpTesting.expectOne(`${environment.apiOrigin}/payments/pay-service-123/simulate`);
    postReq.flush(
      { code: 'PAYMENT_ALREADY_TERMINAL', message: 'Payment is terminal' },
      { status: 409, statusText: 'Conflict' }
    );

    expect(component.simulating()).toBe(false);
    expect(component.simulationError()).toContain('Este pago ya se encuentra en un estado terminal');
  });
});
