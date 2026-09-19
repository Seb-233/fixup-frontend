import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import {
  QuotationControllerService,
  RepairRequestControllerService,
  RepairRequestStatus,
  RequestDetailResponse,
  Specialty,
  provideApi
} from '../../../../api/generated';
import { CurrentUserStore } from '../../../../core/auth/current-user.store';
import { RequestDetailComponent } from './request-detail.component';

describe('RequestDetailComponent (Detalle de solicitud y envío de cotizaciones)', () => {
  let component: RequestDetailComponent;
  let httpTesting: HttpTestingController;
  let userStore: CurrentUserStore;
  let router: Router;

  const mockDetail: RequestDetailResponse = {
    requestId: 'req-detail-1234',
    specialty: Specialty.Plumbing,
    title: 'Gotera en el baño',
    description: 'El agua cae desde el techo cuando abren la ducha.',
    photos: [
      {
        mediaId: 'media-photo-1',
        readUrl: 'http://storage.internal/requests/photo1.jpg?token=read',
        readUrlExpiresAt: '2026-09-20T12:00:00Z'
      }
    ],
    status: RepairRequestStatus.Open,
    assignedFixerUserId: null,
    createdAt: '2026-09-19T10:00:00Z'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RequestDetailComponent],
      providers: [
        RepairRequestControllerService,
        QuotationControllerService,
        CurrentUserStore,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApi(environment.apiOrigin),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'requestId' ? 'req-detail-1234' : null)
              }
            }
          }
        }
      ]
    });

    httpTesting = TestBed.inject(HttpTestingController);
    userStore = TestBed.inject(CurrentUserStore);
    router = TestBed.inject(Router);
    component = TestBed.createComponent(RequestDetailComponent).componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('debe cargar el detalle de la solicitud y renderizar fotos vía readUrl', () => {
    component.ngOnInit();

    const req = httpTesting.expectOne(`${environment.apiOrigin}/requests/req-detail-1234`);
    expect(req.request.method).toBe('GET');
    req.flush(mockDetail);

    expect(component.request()?.requestId).toBe('req-detail-1234');
    expect(component.request()?.photos[0].readUrl).toContain('photo1.jpg');
    // Sin lógica de ownerUserId
    expect((component.request() as unknown as Record<string, unknown>)['ownerUserId']).toBeUndefined();
    expect(component.loading()).toBe(false);
  });

  it('debe manejar error de carga de foto con placeholder y permitir recargar', () => {
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/requests/req-detail-1234`).flush(mockDetail);

    const readUrl = mockDetail.photos[0].readUrl;
    expect(component.failedImageUrls().has(readUrl)).toBe(false);

    component.onImageError(readUrl);
    expect(component.failedImageUrls().has(readUrl)).toBe(true);

    // Recargar el detalle
    component.reloadDetail();
    const reloadReq = httpTesting.expectOne(`${environment.apiOrigin}/requests/req-detail-1234`);
    reloadReq.flush(mockDetail);
    expect(component.failedImageUrls().has(readUrl)).toBe(false);
  });

  describe('Validaciones de formulario de cotización', () => {
    beforeEach(() => {
      userStore.setProfile({
        id: 'fixer-user-1',
        email: 'fixer@fixup.com',
        displayName: 'Fixer User',
        status: 'ACTIVE',
        roles: ['FIXER']
      });
      userStore.setActiveRole('FIXER');
      component.ngOnInit();
      httpTesting.expectOne(`${environment.apiOrigin}/requests/req-detail-1234`).flush(mockDetail);
    });

    it('acepta monto entero positivo seguro, días válidos y mensaje opcional', () => {
      component.form.setValue({
        amount: 350000,
        estimatedDays: 4,
        message: 'Incluye repuestos originales.'
      });

      expect(component.form.valid).toBe(true);
    });

    it('rechaza monto con decimales', () => {
      component.form.controls.amount.setValue(350000.75);
      expect(component.form.controls.amount.hasError('safeInteger')).toBe(true);
      expect(component.form.valid).toBe(false);
    });

    it('rechaza monto infinito', () => {
      component.form.controls.amount.setValue(Infinity as unknown as number);
      expect(component.form.controls.amount.hasError('safeInteger')).toBe(true);
      expect(component.form.valid).toBe(false);
    });

    it('rechaza monto inseguro mayor a Number.MAX_SAFE_INTEGER', () => {
      component.form.controls.amount.setValue(Number.MAX_SAFE_INTEGER + 100);
      expect(component.form.controls.amount.hasError('safeInteger')).toBe(true);
      expect(component.form.valid).toBe(false);
    });

    it('rechaza monto menor a 1', () => {
      component.form.controls.amount.setValue(0);
      expect(component.form.controls.amount.hasError('safeInteger')).toBe(true);
      expect(component.form.valid).toBe(false);
    });

    it('rechaza tiempo estimado menor a 1 o mayor a 365 días', () => {
      component.form.controls.estimatedDays.setValue(0);
      expect(component.form.controls.estimatedDays.hasError('min')).toBe(true);

      component.form.controls.estimatedDays.setValue(366);
      expect(component.form.controls.estimatedDays.hasError('max')).toBe(true);
    });
  });

  describe('Envío de cotización y respuestas de error', () => {
    beforeEach(() => {
      userStore.setProfile({
        id: 'fixer-user-1',
        email: 'fixer@fixup.com',
        displayName: 'Fixer User',
        status: 'ACTIVE',
        roles: ['FIXER']
      });
      userStore.setActiveRole('FIXER');
      component.ngOnInit();
      httpTesting.expectOne(`${environment.apiOrigin}/requests/req-detail-1234`).flush(mockDetail);
    });

    it('envía cotización exitosamente y navega a /quotations/me', () => {
      const navigateSpy = vi.spyOn(router, 'navigate');

      component.form.setValue({
        amount: 500000,
        estimatedDays: 5,
        message: 'Materiales incluidos'
      });

      component.submit();

      const postReq = httpTesting.expectOne(`${environment.apiOrigin}/quotations`);
      expect(postReq.request.method).toBe('POST');
      expect(postReq.request.body).toEqual({
        requestId: 'req-detail-1234',
        amount: 500000,
        estimatedDays: 5,
        message: 'Materiales incluidos'
      });
      postReq.flush({
        id: 'quot-1',
        requestId: 'req-detail-1234',
        fixerUserId: 'fixer-user-1',
        amount: 500000,
        estimatedDays: 5,
        message: 'Materiales incluidos',
        status: 'SUBMITTED',
        createdAt: '2026-09-19T11:00:00Z'
      });

      expect(component.submitted()).toBe(true);
      expect(navigateSpy).toHaveBeenCalledWith(['/quotations/me']);
    });

    it('maneja error 403: perfil de Fixer no verificado', () => {
      component.form.setValue({ amount: 100000, estimatedDays: 2, message: '' });
      component.submit();

      const postReq = httpTesting.expectOne(`${environment.apiOrigin}/quotations`);
      postReq.flush(null, { status: 403, statusText: 'Forbidden' });

      expect(component.submitError()).toContain('todavía no está verificado');
      expect(component.sending()).toBe(false);
    });

    it('maneja error 409 con ALREADY_QUOTED', () => {
      component.form.setValue({ amount: 100000, estimatedDays: 2, message: '' });
      component.submit();

      const postReq = httpTesting.expectOne(`${environment.apiOrigin}/quotations`);
      postReq.flush({ code: 'ALREADY_QUOTED', message: 'Already quoted' }, { status: 409, statusText: 'Conflict' });

      expect(component.submitError()).toContain('Ya enviaste una cotización para esta solicitud');
    });

    it('maneja error 409 con REQUEST_NOT_OPEN', () => {
      component.form.setValue({ amount: 100000, estimatedDays: 2, message: '' });
      component.submit();

      const postReq = httpTesting.expectOne(`${environment.apiOrigin}/quotations`);
      postReq.flush({ code: 'REQUEST_NOT_OPEN', message: 'Closed' }, { status: 409, statusText: 'Conflict' });

      expect(component.submitError()).toContain('La solicitud ya fue asignada a otro técnico');
    });

    it('maneja error 400 y 404', () => {
      component.form.setValue({ amount: 100000, estimatedDays: 2, message: '' });
      component.submit();

      const postReq = httpTesting.expectOne(`${environment.apiOrigin}/quotations`);
      postReq.flush(null, { status: 400, statusText: 'Bad Request' });

      expect(component.submitError()).toContain('Los datos de la cotización son inválidos');
    });
  });
});
