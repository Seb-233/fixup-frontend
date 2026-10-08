import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AdministrationSlaApiService, SlaBoardRequestItem } from './administration-sla-api.service';
import { AdministrationSlaStore } from './administration-sla.store';
import { environment } from '../../../../environments/environment';

describe('AdministrationSlaStore & ApiService', () => {
  let store: AdministrationSlaStore;
  let httpTesting: HttpTestingController;

  const mockItems: SlaBoardRequestItem[] = [
    {
      requestId: 'req-100',
      propertyId: 'prop-200',
      propertyCity: 'Bogotá',
      specialty: 'Plumbing',
      title: 'Tubería rota',
      status: 'SLA_BREACHED',
      urgencyLevel: 'URGENT',
      slaDeadline: '2026-10-10T15:00:00Z',
      slaState: 'BREACHED',
      remainingMinutes: -45,
      assignedFixerUserId: null,
      lastEscalationNotifiedAt: null,
      createdAt: '2026-10-06T12:00:00Z'
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AdministrationSlaApiService, AdministrationSlaStore]
    });

    store = TestBed.inject(AdministrationSlaStore);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('carga datos del API real: actualiza rows, totalCount y loading', () => {
    expect(store.loading()).toBe(false);
    expect(store.rows()).toEqual([]);

    store.load();
    expect(store.loading()).toBe(true);

    const req = httpTesting.expectOne(`${environment.apiOrigin}/administration/sla-board/requests`);
    expect(req.request.method).toBe('GET');
    req.flush(mockItems);

    expect(store.loading()).toBe(false);
    expect(store.rows().length).toBe(1);
    expect(store.rows()[0].requestId).toBe('req-100');
    expect(store.rows()[0].city).toBe('Bogotá');
    expect(store.breachedCount()).toBe(1);
  });

  it('maneja error del API sin inventar datos', () => {
    store.load();
    expect(store.loading()).toBe(true);

    const req = httpTesting.expectOne(`${environment.apiOrigin}/administration/sla-board/requests`);
    req.flush({ message: 'Internal Server Error' }, { status: 500, statusText: 'Error' });

    expect(store.loading()).toBe(false);
    expect(store.rows()).toEqual([]);
    expect(store.error()).toBeTruthy();
  });

  it('acknowledge llama endpoint real POST /administration/sla-board/requests/{id}/acknowledge', () => {
    store.setRows([
      {
        id: 'req-100',
        requestId: 'req-100',
        propertyId: 'prop-200',
        city: 'Bogotá',
        specialty: 'Plumbing',
        title: 'Tubería rota',
        slaDeadline: '2026-10-10T15:00:00Z',
        urgencyLevel: 'URGENT',
        status: 'SLA_BREACHED',
        slaState: 'BREACHED',
        remainingMinutes: -45,
        assignedFixerUserId: null,
        lastEscalationNotifiedAt: null,
        createdAt: '2026-10-06T12:00:00Z'
      }
    ]);

    store.acknowledge('req-100').subscribe();

    const req = httpTesting.expectOne(
      `${environment.apiOrigin}/administration/sla-board/requests/req-100/acknowledge`
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(null);

    expect(store.rows()[0].status).toBe('ASSIGNED');
  });

  it('reassign llama endpoint real POST /administration/sla-board/requests/{id}/reassign con UUID real', () => {
    store.setRows([
      {
        id: 'req-100',
        requestId: 'req-100',
        propertyId: 'prop-200',
        city: 'Bogotá',
        specialty: 'Plumbing',
        title: 'Tubería rota',
        slaDeadline: '2026-10-10T15:00:00Z',
        urgencyLevel: 'URGENT',
        status: 'SLA_BREACHED',
        slaState: 'BREACHED',
        remainingMinutes: -45,
        assignedFixerUserId: null,
        lastEscalationNotifiedAt: null,
        createdAt: '2026-10-06T12:00:00Z'
      }
    ]);

    const realFixerUuid = 'e1a90c58-2082-4467-bc13-883f3458bf59';
    store.reassign('req-100', realFixerUuid).subscribe();

    const req = httpTesting.expectOne(
      `${environment.apiOrigin}/administration/sla-board/requests/req-100/reassign`
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ fixerUserId: realFixerUuid });
    req.flush(null);

    expect(store.rows()[0].assignedFixerUserId).toBe(realFixerUuid);
  });
});
