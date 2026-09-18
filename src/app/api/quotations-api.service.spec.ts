import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Quotation } from '../shared/models/quotation.model';
import { API_ROUTES, apiUrl } from './api.routes';
import { QuotationsApiService } from './quotations-api.service';

describe('QuotationsApiService (FR-UC-18)', () => {
  let service: QuotationsApiService;
  let httpTesting: HttpTestingController;

  const requestId = '11111111-1111-1111-1111-111111111111';

  const mockQuotation: Quotation = {
    id: '33333333-3333-3333-3333-333333333333',
    requestId,
    fixerUserId: '44444444-4444-4444-4444-444444444444',
    amount: 450000,
    estimatedDays: 3,
    message: 'Incluye materiales.',
    status: 'SUBMITTED',
    createdAt: '2026-09-18T15:00:00Z'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [QuotationsApiService, provideHttpClient(), provideHttpClientTesting()]
    });

    service = TestBed.inject(QuotationsApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('debe enviar la cotización con POST en /quotations sin declarar el autor', () => {
    service.submit({
      requestId,
      amount: 450000,
      estimatedDays: 3,
      message: 'Incluye materiales.'
    }).subscribe((res) => expect(res).toEqual(mockQuotation));

    const req = httpTesting.expectOne(apiUrl(API_ROUTES.quotations.base));
    expect(req.request.method).toBe('POST');
    expect(req.request.body.amount).toBe(450000);
    expect(req.request.body.estimatedDays).toBe(3);
    // El backend resuelve el Fixer desde el token validado
    expect(req.request.body.fixerUserId).toBeUndefined();
    expect(req.request.body.status).toBeUndefined();
    req.flush(mockQuotation);
  });

  it('debe consultar las cotizaciones propias con GET en /quotations/me', () => {
    service.listMine().subscribe((res) => expect(res).toEqual([mockQuotation]));

    const req = httpTesting.expectOne(apiUrl(API_ROUTES.quotations.mine));
    expect(req.request.method).toBe('GET');
    req.flush([mockQuotation]);
  });

  it('debe pedir el tablero comparativo de una solicitud', () => {
    service.listForRequest(requestId).subscribe((res) => expect(res).toEqual([mockQuotation]));

    const req = httpTesting.expectOne(apiUrl(API_ROUTES.quotations.forRequest(requestId)));
    expect(req.request.method).toBe('GET');
    req.flush([mockQuotation]);
  });

  it('debe aceptar una cotización con POST y cuerpo vacío', () => {
    service.accept(mockQuotation.id).subscribe();

    const req = httpTesting.expectOne(apiUrl(API_ROUTES.quotations.accept(mockQuotation.id)));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ ...mockQuotation, status: 'ACCEPTED' });
  });
});
