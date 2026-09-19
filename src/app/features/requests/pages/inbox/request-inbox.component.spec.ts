import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import {
  OpenRequestSummaryResponse,
  RepairRequestControllerService,
  Specialty,
  provideApi
} from '../../../../api/generated';
import { RequestInboxComponent } from './request-inbox.component';

describe('RequestInboxComponent (Bandeja del técnico con resumen y filtro en memoria)', () => {
  let component: RequestInboxComponent;
  let httpTesting: HttpTestingController;

  const mockInbox: OpenRequestSummaryResponse[] = [
    {
      requestId: 'req-plumbing-1',
      specialty: Specialty.Plumbing,
      title: 'Fuga de agua en cocina',
      createdAt: '2026-09-19T08:00:00Z'
    },
    {
      requestId: 'req-electrical-1',
      specialty: Specialty.Electrical,
      title: 'Cortocircuito en sala',
      createdAt: '2026-09-19T09:00:00Z'
    },
    {
      requestId: 'req-plumbing-2',
      specialty: Specialty.Plumbing,
      title: 'Cambio de grifería',
      createdAt: '2026-09-19T10:00:00Z'
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RequestInboxComponent],
      providers: [
        RepairRequestControllerService,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApi(environment.apiOrigin)
      ]
    });

    httpTesting = TestBed.inject(HttpTestingController);
    component = TestBed.createComponent(RequestInboxComponent).componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('debe solicitar la bandeja abierta con GET en /requests/open SIN parámetros de consulta', () => {
    component.ngOnInit();

    const req = httpTesting.expectOne(`${environment.apiOrigin}/requests/open`);
    expect(req.request.method).toBe('GET');
    // Sin query specialty: el backend filtra por las especialidades del técnico autenticado
    expect(req.request.params.keys().length).toBe(0);
    req.flush(mockInbox);

    expect(component.allRequests().length).toBe(3);
    expect(component.filteredRequests().length).toBe(3);
    expect(component.loading()).toBe(false);

    // Los elementos son OpenRequestSummaryResponse (sin description ni photos)
    const first = component.filteredRequests()[0];
    expect(first.requestId).toBe('req-plumbing-1');
    const record = first as unknown as Record<string, unknown>;
    expect(record['description']).toBeUndefined();
    expect(record['photos']).toBeUndefined();
  });

  it('debe filtrar en memoria por especialidad sin hacer peticiones HTTP adicionales', () => {
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/requests/open`).flush(mockInbox);

    // Filtra por PLUMBING en memoria
    component.filterBy(Specialty.Plumbing);
    expect(component.filteredRequests().length).toBe(2);
    expect(component.filteredRequests().every((r) => r.specialty === Specialty.Plumbing)).toBe(true);

    // Filtra por ELECTRICAL en memoria
    component.filterBy(Specialty.Electrical);
    expect(component.filteredRequests().length).toBe(1);
    expect(component.filteredRequests()[0].requestId).toBe('req-electrical-1');

    // Filtra por "Todas" (null)
    component.filterBy(null);
    expect(component.filteredRequests().length).toBe(3);

    // Ninguna petición HTTP adicional ocurrió
    httpTesting.verify();
  });

  it('debe manejar error al cargar las solicitudes', () => {
    component.ngOnInit();

    const req = httpTesting.expectOne(`${environment.apiOrigin}/requests/open`);
    req.flush(null, { status: 500, statusText: 'Server Error' });

    expect(component.error()).toContain('No pudimos cargar las solicitudes');
    expect(component.loading()).toBe(false);
  });
});
