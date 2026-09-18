import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RepairRequest } from '../shared/models/repair-request.model';
import { API_ROUTES, apiUrl } from './api.routes';
import { RequestsApiService } from './requests-api.service';

describe('RequestsApiService (FR-UC-18)', () => {
  let service: RequestsApiService;
  let httpTesting: HttpTestingController;

  const mockRequest: RepairRequest = {
    id: '11111111-1111-1111-1111-111111111111',
    ownerUserId: '22222222-2222-2222-2222-222222222222',
    specialty: 'PLUMBING',
    title: 'Gotera en el baño',
    description: 'El agua cae desde el techo.',
    photoKeys: ['fotos/1.jpg'],
    status: 'OPEN',
    assignedFixerUserId: null,
    createdAt: '2026-09-18T15:00:00Z'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [RequestsApiService, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(RequestsApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('debe abrir la solicitud con POST en /requests enviando solo las storage keys', () => {
    service.open({
      specialty: 'PLUMBING',
      title: 'Gotera en el baño',
      description: 'El agua cae desde el techo.',
      photoKeys: ['fotos/1.jpg']
    }).subscribe((res) => expect(res).toEqual(mockRequest));

    const req = httpTesting.expectOne(apiUrl(API_ROUTES.requests.base));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      specialty: 'PLUMBING',
      title: 'Gotera en el baño',
      description: 'El agua cae desde el techo.',
      photoKeys: ['fotos/1.jpg']
    });
    // El autor lo resuelve el backend desde el token, nunca este cuerpo
    expect(req.request.body.ownerUserId).toBeUndefined();
    req.flush(mockRequest);
  });

  it('debe consultar las solicitudes propias con GET en /requests/me', () => {
    service.listMine().subscribe((res) => expect(res).toEqual([mockRequest]));

    const req = httpTesting.expectOne(apiUrl(API_ROUTES.requests.mine));
    expect(req.request.method).toBe('GET');
    req.flush([mockRequest]);
  });

  it('debe pedir la bandeja abierta sin parámetros cuando no se filtra por especialidad', () => {
    service.listOpen().subscribe();

    const req = httpTesting.expectOne(apiUrl(API_ROUTES.requests.open));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('specialty')).toBe(false);
    req.flush([]);
  });

  it('debe enviar la especialidad como parámetro de consulta cuando se filtra', () => {
    service.listOpen('ELECTRICAL').subscribe();

    const req = httpTesting.expectOne(
      (request) =>
        request.url === apiUrl(API_ROUTES.requests.open) &&
        request.params.get('specialty') === 'ELECTRICAL'
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('debe consultar el detalle con el identificador en la ruta', () => {
    service.getById(mockRequest.id).subscribe((res) => expect(res).toEqual(mockRequest));

    const req = httpTesting.expectOne(apiUrl(API_ROUTES.requests.detail(mockRequest.id)));
    expect(req.request.method).toBe('GET');
    req.flush(mockRequest);
  });
});
