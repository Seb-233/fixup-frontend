import { HttpResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
  CreateProjectRequest,
  OwnerDebtDetail,
  PaymentControllerService,
  PaymentMethod,
  ProjectResponse,
  PropertySummary,
  RemodelingProgressStatus,
  UploadTicketDto,
  provideApi
} from '../../../../api/generated';
import { RequestMediaService } from '../../../requests/services/request-media.service';
import { RemodelingStore } from '../../services/remodeling.store';
import { RemodelingCreateComponent } from './remodeling-create.component';

describe('RemodelingCreateComponent', () => {
  let fixture: ComponentFixture<RemodelingCreateComponent>;
  let component: RemodelingCreateComponent;
  let httpTesting: HttpTestingController;
  let router: Router;
  let mediaService: RequestMediaService;

  const mockProperty: PropertySummary = {
    id: 'prop-111',
    name: 'Casa Campestre',
    address: 'Vereda El Hato Km 4',
    city: 'La Calera',
    areaM2: 240
  };

  const mockCreatedProject: ProjectResponse = {
    id: 'proj-new-123',
    propertyId: 'prop-111',
    ownerUserId: 'owner-me',
    title: 'Remodelación integral',
    description: 'Renovación de cocina y baños',
    status: RemodelingProgressStatus.Open,
    requirementCount: 2,
    assignedCount: 0,
    completedCount: 0,
    createdAt: '2026-10-13T10:00:00Z',
    updatedAt: '2026-10-13T10:00:00Z',
    requirements: []
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RemodelingCreateComponent],
      providers: [
        RemodelingStore,
        RequestMediaService,
        PaymentControllerService,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApi(environment.apiOrigin)
      ]
    });

    httpTesting = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    mediaService = TestBed.inject(RequestMediaService);
    fixture = TestBed.createComponent(RemodelingCreateComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
    fixture?.destroy();
  });

  function initialize(
    properties: PropertySummary[] = [mockProperty],
    debts: OwnerDebtDetail[] = []
  ): void {
    fixture.detectChanges();
    const req = httpTesting.expectOne(`${environment.apiOrigin}/properties/me`);
    expect(req.request.method).toBe('GET');
    req.flush(properties);

    const debtReq = httpTesting.expectOne(`${environment.apiOrigin}/payments/me/debts`);
    expect(debtReq.request.method).toBe('GET');
    debtReq.flush(debts);

    fixture.detectChanges();
  }

  it('carga las propiedades propias del OWNER y deudas al iniciar', () => {
    initialize();

    expect(component.loadingProperties()).toBe(false);
    expect(component.properties()).toEqual([mockProperty]);
    expect(component.hasDebt()).toBe(false);
    const select = fixture.nativeElement.querySelector('#select-property') as HTMLSelectElement;
    expect(select.options.length).toBe(2); // placeholder + 1 property
  });

  it('inicia con exactamente 1 necesidad y exige paymentMethod en cada una', () => {
    initialize();

    expect(component.requirementsArray.length).toBe(1);
    expect(component.requirementsArray.at(0).get('paymentMethod')?.value).toBeNull();
    expect(component.requirementsArray.at(0).get('paymentMethod')?.invalid).toBe(true);

    component.addRequirement();
    expect(component.requirementsArray.length).toBe(2);
    expect(component.requirementsArray.at(1).get('paymentMethod')?.value).toBeNull();
    expect(component.requirementsArray.at(1).get('paymentMethod')?.invalid).toBe(true);
  });

  it('permite eliminar una necesidad pero nunca permite quedar en 0', () => {
    initialize();

    component.addRequirement();
    expect(component.requirementsArray.length).toBe(2);

    component.removeRequirement(1);
    expect(component.requirementsArray.length).toBe(1);

    // Intentar eliminar la última necesidad no hace nada
    component.removeRequirement(0);
    expect(component.requirementsArray.length).toBe(1);
  });

  it('valida campos obligatorios y no envía POST si el formulario es inválido por falta de paymentMethod', () => {
    initialize();

    component.form.patchValue({
      propertyId: 'prop-111',
      title: 'Remodelación',
      description: 'Sin método de pago'
    });
    component.requirementsArray.at(0).patchValue({
      title: 'Pintura',
      description: 'Paredes',
      urgencyLevel: 'LOW'
      // paymentMethod ausente
    });

    component.submit();
    expect(component.form.invalid).toBe(true);
    httpTesting.expectNone(`${environment.apiOrigin}/remodelings`);
  });

  it('envía POST /remodelings con requerimientos mixtos (TRANSFER y CASH) sin specialty y navega al detalle en 201', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    initialize();

    component.form.patchValue({
      propertyId: 'prop-111',
      title: 'Remodelación integral',
      description: 'Renovación de cocina y baños'
    });

    // Primera necesidad: TRANSFER
    component.requirementsArray.at(0).patchValue({
      title: 'Cambio de tubería',
      description: 'Reemplazo de tubería galvanizada por PVC',
      urgencyLevel: 'HIGH',
      paymentMethod: PaymentMethod.Transfer
    });

    // Segunda necesidad: CASH
    component.addRequirement();
    component.requirementsArray.at(1).patchValue({
      title: 'Enchape cerámico',
      description: 'Instalar baldosa en paredes y pisos',
      urgencyLevel: 'MEDIUM',
      paymentMethod: PaymentMethod.Cash
    });

    fixture.detectChanges();
    component.submit();

    const postReq = httpTesting.expectOne(`${environment.apiOrigin}/remodelings`);
    expect(postReq.request.method).toBe('POST');

    const expectedPayload: CreateProjectRequest = {
      propertyId: 'prop-111',
      title: 'Remodelación integral',
      description: 'Renovación de cocina y baños',
      requirements: [
        {
          title: 'Cambio de tubería',
          description: 'Reemplazo de tubería galvanizada por PVC',
          urgencyLevel: 'HIGH',
          paymentMethod: PaymentMethod.Transfer,
          mediaIds: []
        },
        {
          title: 'Enchape cerámico',
          description: 'Instalar baldosa en paredes y pisos',
          urgencyLevel: 'MEDIUM',
          paymentMethod: PaymentMethod.Cash,
          mediaIds: []
        }
      ]
    };

    expect(postReq.request.body).toEqual(expectedPayload);
    // Verificar expresamente que no se envía specialty
    postReq.request.body.requirements.forEach((req: Record<string, unknown>) => {
      expect(req['specialty']).toBeUndefined();
    });

    postReq.flush(mockCreatedProject);

    expect(navigateSpy).toHaveBeenCalledWith(['/remodelings', 'proj-new-123']);
  });

  it('bloquea creación si el propietario tiene deuda OUTSTANDING y no permite enviar', () => {
    initialize([mockProperty], [
      {
        debtId: 'debt-123',
        status: 'OUTSTANDING',
        amount: 50000
      }
    ]);

    expect(component.hasDebt()).toBe(true);
    expect(component.outstandingDebt()?.amount).toBe(50000);

    component.form.patchValue({
      propertyId: 'prop-111',
      title: 'Remodelación',
      description: 'Intento con deuda'
    });
    component.requirementsArray.at(0).patchValue({
      title: 'Carpintería',
      description: 'Mueble',
      urgencyLevel: 'LOW',
      paymentMethod: PaymentMethod.Cash
    });

    component.submit();

    expect(component.submitError()).toContain('saldo pendiente');
    httpTesting.expectNone(`${environment.apiOrigin}/remodelings`);
  });

  it('maneja 409 OWNER_HAS_OUTSTANDING_DEBT del backend refrescando deuda y mostrando aviso', () => {
    initialize();

    component.form.patchValue({
      propertyId: 'prop-111',
      title: 'Remodelación',
      description: 'Intento que choca con deuda en backend'
    });
    component.requirementsArray.at(0).patchValue({
      title: 'Plomería',
      description: 'Tubería',
      urgencyLevel: 'MEDIUM',
      paymentMethod: PaymentMethod.Transfer
    });

    component.submit();

    const postReq = httpTesting.expectOne(`${environment.apiOrigin}/remodelings`);
    postReq.flush(
      { code: 'OWNER_HAS_OUTSTANDING_DEBT', message: 'Owner has outstanding debt' },
      { status: 409, statusText: 'Conflict' }
    );

    // Debe refrescar deudas
    const debtReq = httpTesting.expectOne(`${environment.apiOrigin}/payments/me/debts`);
    debtReq.flush([{ debtId: 'debt-999', status: 'OUTSTANDING', amount: 35000 }]);

    fixture.detectChanges();

    expect(component.submitError()).toContain('saldo pendiente');
    expect(component.form.get('title')?.value).toBe('Remodelación');
    expect(component.hasDebt()).toBe(true);
  });

  it('asocia fotos confirmadas a la necesidad correcta vía RequestMediaService', () => {
    initialize();

    const file = new File(['fake-img'], 'fuga.jpg', { type: 'image/jpeg' });
    vi.spyOn(mediaService, 'validateFile').mockReturnValue({ valid: true });
    vi.spyOn(mediaService, 'requestUploadTicket').mockReturnValue(of({
      mediaId: 'media-uuid-1',
      uploadUrl: 'http://storage/test',
      method: 'PUT',
      headers: {},
      expiresAt: '2026-10-13T12:00:00Z'
    }));
    vi.spyOn(mediaService, 'uploadBinary').mockReturnValue(of(new HttpResponse({ status: 200 })));
    vi.spyOn(mediaService, 'confirmUpload').mockReturnValue(of({
      mediaId: 'media-uuid-1',
      status: 'CONFIRMED'
    }));

    component.onFileSelected({ target: { files: [file], value: '' } } as never, 0);

    expect(component.mediaState(0).mediaIds).toEqual(['media-uuid-1']);
  });

  it('no permite eliminar una necesidad si tiene una subida de fotos en progreso', () => {
    initialize();
    component.addRequirement();
    expect(component.requirementsArray.length).toBe(2);

    const pendingTicket = new Subject<UploadTicketDto>();
    vi.spyOn(mediaService, 'validateFile').mockReturnValue({ valid: true });
    vi.spyOn(mediaService, 'requestUploadTicket').mockReturnValue(pendingTicket.asObservable());

    const file = new File(['data'], 'test.png', { type: 'image/png' });
    component.onFileSelected({ target: { files: [file], value: '' } } as never, 1);

    expect(component.mediaState(1).uploading).toBe(true);
    expect(component.hasUploadingMedia()).toBe(true);

    component.removeRequirement(1);
    expect(component.requirementsArray.length).toBe(2);

    pendingTicket.complete();
  });
});
