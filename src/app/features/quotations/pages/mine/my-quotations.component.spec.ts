import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import {
  QuotationControllerService,
  QuotationResponse,
  QuotationStatus,
  provideApi
} from '../../../../api/generated';
import { MyQuotationsComponent } from './my-quotations.component';

describe('MyQuotationsComponent (Cotizaciones propias del Fixer)', () => {
  let component: MyQuotationsComponent;
  let httpTesting: HttpTestingController;

  const mockQuotations: QuotationResponse[] = [
    {
      id: 'q-1',
      requestId: 'req-1',
      fixerUserId: 'fixer-1',
      amount: 250000,
      estimatedDays: 3,
      message: 'Mano de obra y materiales',
      status: QuotationStatus.Accepted,
      createdAt: '2026-09-19T08:00:00Z'
    },
    {
      id: 'q-2',
      requestId: 'req-2',
      fixerUserId: 'fixer-1',
      amount: 180000,
      estimatedDays: 1,
      message: null,
      status: QuotationStatus.Submitted,
      createdAt: '2026-09-19T09:00:00Z'
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MyQuotationsComponent],
      providers: [
        QuotationControllerService,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApi(environment.apiOrigin)
      ]
    });

    httpTesting = TestBed.inject(HttpTestingController);
    component = TestBed.createComponent(MyQuotationsComponent).componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('debe listar las cotizaciones propias consultando /quotations/me', () => {
    component.ngOnInit();

    const req = httpTesting.expectOne(`${environment.apiOrigin}/quotations/me`);
    expect(req.request.method).toBe('GET');
    req.flush(mockQuotations);

    expect(component.quotations().length).toBe(2);
    expect(component.accepted()).toBe(1);
    expect(component.loading()).toBe(false);
  });

  it('debe manejar error al consultar las cotizaciones', () => {
    component.ngOnInit();

    const req = httpTesting.expectOne(`${environment.apiOrigin}/quotations/me`);
    req.flush(null, { status: 500, statusText: 'Server Error' });

    expect(component.error()).toContain('No pudimos cargar tus cotizaciones');
    expect(component.loading()).toBe(false);
  });
});
