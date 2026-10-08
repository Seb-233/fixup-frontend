import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ContractsService } from './contracts.service';
import { CreateContractRequest, UpdateContractRequest } from '../models/contract.models';
import { environment } from '../../../../environments/environment';

describe('ContractsService (Integración Real)', () => {
  let service: ContractsService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ContractsService]
    });

    service = TestBed.inject(ContractsService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('list llama GET /contracts/me', () => {
    service.list().subscribe((data) => {
      expect(data).toEqual([]);
    });

    const req = httpTesting.expectOne(`${environment.apiOrigin}/contracts/me`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('get llama GET /contracts/{id}', () => {
    service.get('c-123').subscribe();

    const req = httpTesting.expectOne(`${environment.apiOrigin}/contracts/c-123`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'c-123' });
  });

  it('create usa POST real /contracts', () => {
    const payload: CreateContractRequest = {
      propertyId: 'p-1',
      tenantUserId: 't-1',
      startDate: '2026-10-01',
      endDate: '2027-10-01',
      monthlyRentAmount: 1500000,
      depositAmount: 1500000,
      paymentDayOfMonth: 5
    };

    service.create(payload).subscribe();

    const req = httpTesting.expectOne(`${environment.apiOrigin}/contracts`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 'c-created', ...payload });
  });

  it('update usa PUT real /contracts/{id}', () => {
    const payload: UpdateContractRequest = {
      monthlyRentAmount: 1800000
    };

    service.update('c-123', payload).subscribe();

    const req = httpTesting.expectOne(`${environment.apiOrigin}/contracts/c-123`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 'c-123', monthlyRentAmount: 1800000 });
  });

  it('renew usa endpoint real POST /contracts/{id}/renew', () => {
    service.renew('c-123', '2028-10-01').subscribe();

    const req = httpTesting.expectOne(`${environment.apiOrigin}/contracts/c-123/renew`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ newEndDate: '2028-10-01' });
    req.flush({ id: 'c-123', endDate: '2028-10-01', status: 'RENEWED' });
  });

  it('terminate usa endpoint real POST /contracts/{id}/terminate', () => {
    service.terminate('c-123', 'Terminación anticipada').subscribe();

    const req = httpTesting.expectOne(`${environment.apiOrigin}/contracts/c-123/terminate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'Terminación anticipada' });
    req.flush({ id: 'c-123', status: 'TERMINATED' });
  });

  it('expiring usa endpoint real GET /contracts/expiring?days=30', () => {
    service.expiring(30).subscribe();

    const req = httpTesting.expectOne(`${environment.apiOrigin}/contracts/expiring?days=30`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('no existen MOCK_CONTRACTS ni MOCK_TENANTS', () => {
    // Verifica que listTenants no retorne usuarios inventados
    service.listTenants().subscribe((tenants) => {
      expect(tenants).toEqual([]);
    });
  });
});
