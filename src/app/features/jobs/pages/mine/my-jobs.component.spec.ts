import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import {
  JobControllerService,
  JobResponse,
  JobStatus,
  PaymentMethod,
  provideApi
} from '../../../../api/generated';
import { MyJobsComponent } from './my-jobs.component';

describe('MyJobsComponent (Gestión y liquidación de trabajos)', () => {
  let component: MyJobsComponent;
  let httpTesting: HttpTestingController;

  const mockTransferJob: JobResponse = {
    id: 'job-transfer-1',
    requestId: 'req-1',
    quotationId: 'quot-1',
    ownerUserId: 'owner-1',
    agreedAmount: 250000,
    status: JobStatus.Assigned,
    paymentMethod: PaymentMethod.Transfer,
    createdAt: '2026-10-15T08:00:00Z'
  };

  const mockCashJob: JobResponse = {
    id: 'job-cash-2',
    requestId: 'req-2',
    quotationId: 'quot-2',
    ownerUserId: 'owner-1',
    agreedAmount: 180000,
    status: JobStatus.Assigned,
    paymentMethod: PaymentMethod.Cash,
    createdAt: '2026-10-15T09:00:00Z'
  };

  const mockCompletedJob: JobResponse = {
    id: 'job-completed-3',
    requestId: 'req-3',
    quotationId: 'quot-3',
    ownerUserId: 'owner-1',
    agreedAmount: 300000,
    status: JobStatus.Completed,
    paymentMethod: PaymentMethod.Transfer,
    createdAt: '2026-10-10T08:00:00Z',
    completedAt: '2026-10-12T14:00:00Z'
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MyJobsComponent],
      providers: [
        JobControllerService,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApi(environment.apiOrigin)
      ]
    });

    httpTesting = TestBed.inject(HttpTestingController);
    component = TestBed.createComponent(MyJobsComponent).componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
    TestBed.resetTestingModule();
  });

  it('debe listar los trabajos activos y cerrados con monto acordado y método de pago', () => {
    component.ngOnInit();

    const req = httpTesting.expectOne(`${environment.apiOrigin}/jobs/me`);
    expect(req.request.method).toBe('GET');
    req.flush([mockTransferJob, mockCashJob, mockCompletedJob]);

    expect(component.loading()).toBe(false);
    expect(component.jobs().length).toBe(3);
    expect(component.open().length).toBe(2);
    expect(component.closed().length).toBe(1);

    expect(component.methodLabel(mockTransferJob.paymentMethod)).toBe('Transferencia');
    expect(component.methodLabel(mockCashJob.paymentMethod)).toBe('Efectivo');
    expect(component.statusLabel(mockTransferJob.status)).toBe('Asignado');
    expect(component.statusLabel(mockCompletedJob.status)).toBe('Cerrado');
  });

  it('debe completar un trabajo TRANSFER directamente sin modal de efectivo y reconsultar', () => {
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/jobs/me`).flush([mockTransferJob]);

    // Click en completar trabajo transfer
    component.onCompleteClick(mockTransferJob);

    // No debe abrir modal de cash
    expect(component.activeCashJob()).toBeNull();
    expect(component.closingId()).toBe('job-transfer-1');

    const completeReq = httpTesting.expectOne(`${environment.apiOrigin}/jobs/job-transfer-1/complete`);
    expect(completeReq.request.method).toBe('POST');
    expect(completeReq.request.body).toEqual({});
    completeReq.flush({ ...mockTransferJob, status: JobStatus.Completed });

    expect(component.closingId()).toBeNull();
    expect(component.successMessage()).toContain('Trabajo cerrado exitosamente');

    // Refetch automático tras completar
    const refetchReq = httpTesting.expectOne(`${environment.apiOrigin}/jobs/me`);
    refetchReq.flush([{ ...mockTransferJob, status: JobStatus.Completed }]);
    expect(component.open().length).toBe(0);
    expect(component.closed().length).toBe(1);
  });

  it('debe abrir modal interactivo para trabajo CASH y completar con pago total recibido', () => {
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/jobs/me`).flush([mockCashJob]);

    component.onCompleteClick(mockCashJob);

    // Debe abrir modal con el trabajo CASH activo
    expect(component.activeCashJob()?.id).toBe('job-cash-2');
    expect(component.cashFullReceived()).toBe(true);

    // Confirmar pago completo
    component.confirmCashComplete(mockCashJob);

    const completeReq = httpTesting.expectOne(`${environment.apiOrigin}/jobs/job-cash-2/complete`);
    expect(completeReq.request.method).toBe('POST');
    expect(completeReq.request.body).toEqual({ receivedAmount: '180000' });
    completeReq.flush({ ...mockCashJob, status: JobStatus.Completed });

    expect(component.activeCashJob()).toBeNull();
    expect(component.successMessage()).toContain('pago total recibido');

    // Refetch
    httpTesting.expectOne(`${environment.apiOrigin}/jobs/me`).flush([{ ...mockCashJob, status: JobStatus.Completed }]);
  });

  it('debe permitir pago parcial o 0 en efectivo para trabajo CASH validando rangos', () => {
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/jobs/me`).flush([mockCashJob]);

    component.onCompleteClick(mockCashJob);
    component.setCashChoice(false);
    expect(component.cashFullReceived()).toBe(false);

    // Validación: monto negativo
    component.cashReceivedInput = '-500';
    component.confirmCashComplete(mockCashJob);
    expect(component.cashValidationError()).toContain('no puede ser negativo');

    // Validación: monto superior al acordado (180000)
    component.cashReceivedInput = '200000';
    component.confirmCashComplete(mockCashJob);
    expect(component.cashValidationError()).toContain('superior al acordado');

    // Válido: monto 0
    component.cashReceivedInput = '0';
    component.confirmCashComplete(mockCashJob);
    expect(component.cashValidationError()).toBeNull();

    const completeReq0 = httpTesting.expectOne(`${environment.apiOrigin}/jobs/job-cash-2/complete`);
    expect(completeReq0.request.body).toEqual({ receivedAmount: '0' });
    completeReq0.flush({ ...mockCashJob, status: JobStatus.Completed });

    expect(component.successMessage()).toContain('saldo pendiente');
    httpTesting.expectOne(`${environment.apiOrigin}/jobs/me`).flush([]);
  });

  it('debe liquidar monto parcial válido (ej: 100000 de 180000) y enviar string al backend', () => {
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/jobs/me`).flush([mockCashJob]);

    component.onCompleteClick(mockCashJob);
    component.setCashChoice(false);
    component.cashReceivedInput = '100000';

    component.confirmCashComplete(mockCashJob);

    const completeReq = httpTesting.expectOne(`${environment.apiOrigin}/jobs/job-cash-2/complete`);
    expect(completeReq.request.body).toEqual({ receivedAmount: '100000' });
    completeReq.flush({ ...mockCashJob, status: JobStatus.Completed });

    expect(component.successMessage()).toContain('saldo pendiente');
    httpTesting.expectOne(`${environment.apiOrigin}/jobs/me`).flush([]);
  });
});
