import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import {
  AcceptedQuotationResponse,
  PaymentMethod,
  QuotationControllerService,
  QuotationResponse,
  QuotationStatus,
  RepairRequestControllerService,
  RepairRequestStatus,
  Specialty,
  provideApi
} from '../../../../api/generated';
import { QuotationBoardComponent } from './quotation-board.component';

describe('QuotationBoardComponent (Tablero comparativo con accept y reject)', () => {
  let component: QuotationBoardComponent;
  let httpTesting: HttpTestingController;
  let router: Router;

  const mockQuotations: QuotationResponse[] = [
    {
      id: 'quot-1',
      requestId: 'req-board-1',
      fixerUserId: 'fixer-1',
      amount: 300000,
      estimatedDays: 2,
      message: 'Oferta más económica',
      status: QuotationStatus.Submitted,
      createdAt: '2026-09-19T08:00:00Z'
    },
    {
      id: 'quot-2',
      requestId: 'req-board-1',
      fixerUserId: 'fixer-2',
      amount: 450000,
      estimatedDays: 4,
      message: 'Incluye repuestos importados',
      status: QuotationStatus.Submitted,
      createdAt: '2026-09-19T09:00:00Z'
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [QuotationBoardComponent],
      providers: [
        QuotationControllerService,
        RepairRequestControllerService,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApi(environment.apiOrigin),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'requestId' ? 'req-board-1' : null)
              }
            }
          }
        }
      ]
    });

    httpTesting = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    component = TestBed.createComponent(QuotationBoardComponent).componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('debe cargar las cotizaciones de la solicitud y los detalles al iniciar', () => {
    component.ngOnInit();

    const reqDetail = httpTesting.expectOne(`${environment.apiOrigin}/requests/req-board-1`);
    expect(reqDetail.request.method).toBe('GET');
    reqDetail.flush({
      requestId: 'req-board-1',
      specialty: Specialty.Plumbing,
      title: 'Tubería rota',
      description: 'Detalle...',
      photos: [],
      status: RepairRequestStatus.Open,
      createdAt: '2026-09-19'
    });

    const reqQuotations = httpTesting.expectOne(`${environment.apiOrigin}/quotations/for-request/req-board-1`);
    expect(reqQuotations.request.method).toBe('GET');
    reqQuotations.flush(mockQuotations);

    expect(component.quotations().length).toBe(2);
    expect(component.request()?.title).toBe('Tubería rota');
    expect(component.assigned()).toBe(false);
  });

  it('debe aceptar cotización con método TRANSFER y navegar a la pasarela de pagos', () => {
    vi.spyOn(router, 'navigate');
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/requests/req-board-1`).flush(null);
    httpTesting.expectOne(`${environment.apiOrigin}/quotations/for-request/req-board-1`).flush(mockQuotations);

    component.accept(mockQuotations[0]);

    expect(component.operatingId()).toBe('quot-1');
    expect(component.operatingAction()).toBe('accept');

    const acceptReq = httpTesting.expectOne(`${environment.apiOrigin}/quotations/quot-1/accept`);
    expect(acceptReq.request.method).toBe('POST');
    const transferResponse: AcceptedQuotationResponse = {
      quotationId: 'quot-1',
      requestId: 'req-board-1',
      paymentMethod: PaymentMethod.Transfer,
      paymentId: 'pay-transfer-123'
    };
    acceptReq.flush(transferResponse);

    expect(component.operatingId()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/payments', 'pay-transfer-123']);
  });

  it('debe aceptar cotización con método CASH, recargar el tablero y no navegar a pasarela', () => {
    vi.spyOn(router, 'navigate');
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/requests/req-board-1`).flush(null);
    httpTesting.expectOne(`${environment.apiOrigin}/quotations/for-request/req-board-1`).flush(mockQuotations);

    component.accept(mockQuotations[0]);

    const acceptReq = httpTesting.expectOne(`${environment.apiOrigin}/quotations/quot-1/accept`);
    expect(acceptReq.request.method).toBe('POST');
    const cashResponse: AcceptedQuotationResponse = {
      quotationId: 'quot-1',
      requestId: 'req-board-1',
      paymentMethod: PaymentMethod.Cash
    };
    acceptReq.flush(cashResponse);

    expect(component.operatingId()).toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();

    // Recarga del tablero tras la aceptación en efectivo
    const reloadReq = httpTesting.expectOne(`${environment.apiOrigin}/quotations/for-request/req-board-1`);
    reloadReq.flush([
      { ...mockQuotations[0], status: QuotationStatus.Accepted },
      { ...mockQuotations[1], status: QuotationStatus.Rejected }
    ]);

    expect(component.assigned()).toBe(true);
  });

  it('debe ejecutar la acción de RECHAZAR cotización y recargar el tablero', () => {
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/requests/req-board-1`).flush(null);
    httpTesting.expectOne(`${environment.apiOrigin}/quotations/for-request/req-board-1`).flush(mockQuotations);

    component.reject(mockQuotations[1]);

    expect(component.operatingId()).toBe('quot-2');
    expect(component.operatingAction()).toBe('reject');

    const rejectReq = httpTesting.expectOne(`${environment.apiOrigin}/quotations/quot-2/reject`);
    expect(rejectReq.request.method).toBe('POST');
    rejectReq.flush({
      ...mockQuotations[1],
      status: QuotationStatus.Rejected
    });

    expect(component.operatingId()).toBeNull();

    // Recarga del tablero tras el rechazo
    const reloadReq = httpTesting.expectOne(`${environment.apiOrigin}/quotations/for-request/req-board-1`);
    reloadReq.flush([
      mockQuotations[0],
      { ...mockQuotations[1], status: QuotationStatus.Rejected }
    ]);

    expect(component.quotations()[1].status).toBe(QuotationStatus.Rejected);
  });

  it('debe manejar errores 403 y 409 al operar sobre cotizaciones', () => {
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/requests/req-board-1`).flush(null);
    httpTesting.expectOne(`${environment.apiOrigin}/quotations/for-request/req-board-1`).flush(mockQuotations);

    component.accept(mockQuotations[0]);
    const acceptReq = httpTesting.expectOne(`${environment.apiOrigin}/quotations/quot-1/accept`);
    acceptReq.flush(null, { status: 409, statusText: 'Conflict' });

    expect(component.actionError()).toContain('Esta oferta ya no se puede modificar');
    expect(component.operatingId()).toBeNull();
  });

  it('calcula la navegación hacia atrás hacia remodelación cuando provino de remodelaciones', () => {
    const route = TestBed.inject(ActivatedRoute);
    (route.snapshot as unknown as Record<string, unknown>)['queryParamMap'] = {
      get: (key: string) => {
        if (key === 'from') return 'remodelings';
        if (key === 'projectId') return 'proj-bathroom-1';
        return null;
      }
    };

    expect(component.backNavigation()).toEqual({
      commands: ['/remodelings', 'proj-bathroom-1'],
      label: '← Volver al proyecto de remodelación'
    });
  });

  it('calcula la navegación hacia atrás hacia mis solicitudes cuando provino de requests', () => {
    const route = TestBed.inject(ActivatedRoute);
    (route.snapshot as unknown as Record<string, unknown>)['queryParamMap'] = {
      get: (key: string) => (key === 'from' ? 'requests' : null)
    };

    expect(component.backNavigation()).toEqual({
      commands: ['/requests'],
      label: '← Volver a mis solicitudes'
    });
  });
});
