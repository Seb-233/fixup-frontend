import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ContractsStore } from './contracts.store';
import { ContractResponse } from '../models/contract.models';

describe('ContractsStore', () => {
  let store: ContractsStore;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ContractsStore,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    httpTesting = TestBed.inject(HttpTestingController);
    store = TestBed.inject(ContractsStore);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('no realiza llamadas HTTP al ser instanciado en el constructor', () => {
    expect(store.loading()).toBe(false);
    expect(store.loaded()).toBe(false);
    expect(store.contracts()).toEqual([]);
    const requests = httpTesting.match((req) => req.url.includes('/contracts/me'));
    expect(requests.length).toBe(0);
  });

  it('realiza llamada GET /contracts/me cuando se invoca load() explícitamente', () => {
    const mockContracts: ContractResponse[] = [
      {
        id: 'c-1',
        propertyId: 'prop-1',
        ownerUserId: 'owner-1',
        tenantUserId: 'tenant-1',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        monthlyRentAmount: 1500000,
        depositAmount: 1500000,
        paymentDayOfMonth: 5,
        status: 'ACTIVE',
        renewalNoticeDays: 30,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z'
      }
    ];

    store.load();
    expect(store.loading()).toBe(true);

    const req = httpTesting.expectOne((r) => r.url.includes('/contracts/me'));
    expect(req.request.method).toBe('GET');
    req.flush(mockContracts);

    expect(store.loading()).toBe(false);
    expect(store.loaded()).toBe(true);
    expect(store.contracts()).toEqual(mockContracts);
  });

  it('no duplica la llamada HTTP si ya está cargado y no se fuerza', () => {
    store.load();
    const req1 = httpTesting.expectOne((r) => r.url.includes('/contracts/me'));
    req1.flush([]);

    expect(store.loaded()).toBe(true);

    // Segunda invocación sin forzar
    store.load();
    const requests = httpTesting.match((r) => r.url.includes('/contracts/me'));
    expect(requests.length).toBe(0);
  });

  it('permite recargar si se invoca con force = true', () => {
    store.load();
    const req1 = httpTesting.expectOne((r) => r.url.includes('/contracts/me'));
    req1.flush([]);

    store.load(true);
    const req2 = httpTesting.expectOne((r) => r.url.includes('/contracts/me'));
    expect(req2.request.method).toBe('GET');
    req2.flush([]);
  });

  it('restablece loading a false si ocurre un error en la carga', () => {
    store.load();
    const req = httpTesting.expectOne((r) => r.url.includes('/contracts/me'));
    req.flush('Forbidden', { status: 403, statusText: 'Forbidden' });

    expect(store.loading()).toBe(false);
    expect(store.loaded()).toBe(false);
  });
});
