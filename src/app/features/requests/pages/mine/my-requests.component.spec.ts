import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import {
  RepairRequestControllerService,
  RepairRequestStatus,
  RequestDetailResponse,
  PropertyControllerService,
  PropertySummary,
  Specialty,
  provideApi
} from '../../../../api/generated';
import { RequestMediaService } from '../../services/request-media.service';
import { CurrentUserStore } from '../../../../core/auth/current-user.store';
import { MyRequestsComponent } from './my-requests.component';

describe('MyRequestsComponent (Creación y listado de solicitudes con medios seguros)', () => {
  let component: MyRequestsComponent;
  let fixture: ComponentFixture<MyRequestsComponent>;
  let httpTesting: HttpTestingController;
  let userStore: CurrentUserStore;
  let requestedPropertyId: string | null;

  const mockRequest: RequestDetailResponse = {
    requestId: 'req-1111-1111',
    specialty: Specialty.Plumbing,
    title: 'Gotera en el baño',
    description: 'El agua cae desde el techo.',
    photos: [
      {
        mediaId: 'media-1111',
        readUrl: 'http://storage.local/photo1.jpg',
        readUrlExpiresAt: '2026-09-20T12:00:00Z'
      }
    ],
    status: RepairRequestStatus.Open,
    assignedFixerUserId: null,
    createdAt: '2026-09-19T10:00:00Z'
  };

  const mockProperty: PropertySummary = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Apartamento 301',
    address: 'Carrera 7 # 40-62',
    city: 'Bogotá',
    areaM2: 72
  };

  beforeEach(() => {
    requestedPropertyId = null;
    TestBed.configureTestingModule({
      imports: [MyRequestsComponent],
      providers: [
        RepairRequestControllerService,
        PropertyControllerService,
        RequestMediaService,
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (name: string) => (name === 'propertyId' ? requestedPropertyId : null)
              }
            }
          }
        },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApi(environment.apiOrigin)
      ]
    });

    httpTesting = TestBed.inject(HttpTestingController);
    userStore = TestBed.inject(CurrentUserStore);
    userStore.setRoles(['OWNER']);
    userStore.setActiveRole('OWNER');
    fixture = TestBed.createComponent(MyRequestsComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
  });

  function initialize(
    requests: RequestDetailResponse[] = [],
    properties: PropertySummary[] = [mockProperty]
  ): void {
    component.ngOnInit();
    const requestsRequest = httpTesting.expectOne(`${environment.apiOrigin}/requests/me`);
    expect(requestsRequest.request.method).toBe('GET');
    requestsRequest.flush(requests);
    const propertiesRequest = httpTesting.expectOne(`${environment.apiOrigin}/properties/me`);
    expect(propertiesRequest.request.method).toBe('GET');
    expect(propertiesRequest.request.headers.get('Accept')).toBe('application/json');
    propertiesRequest.flush(properties);
  }

  function initializeReadOnly(
    role: 'TENANT' | 'REAL_ESTATE_MANAGER',
    requests: RequestDetailResponse[] = []
  ): HTMLElement {
    userStore.setRoles([role]);
    userStore.setActiveRole(role);
    fixture.detectChanges();
    const requestsRequest = httpTesting.expectOne(`${environment.apiOrigin}/requests/me`);
    expect(requestsRequest.request.method).toBe('GET');
    requestsRequest.flush(requests);
    httpTesting.expectNone(`${environment.apiOrigin}/properties/me`);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('debe cargar las solicitudes y propiedades propias al iniciar', () => {
    initialize([mockRequest]);

    expect(component.requests().length).toBe(1);
    expect(component.requests()[0].requestId).toBe('req-1111-1111');
    expect(component.loading()).toBe(false);
    expect(component.properties()).toEqual([mockProperty]);
    expect(component.propertiesLoading()).toBe(false);
  });

  it('debe permitir crear una solicitud sin fotos (0 fotos)', () => {
    initialize();

    component.form.setValue({
      propertyId: mockProperty.id!,
      title: 'Reparar puerta',
      description: 'La puerta no cierra bien.'
    });

    expect(component.photos().length).toBe(0);
    expect(component.allPhotosReady()).toBe(true);

    component.submit();

    const postReq = httpTesting.expectOne(`${environment.apiOrigin}/requests`);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({
      propertyId: mockProperty.id,
      title: 'Reparar puerta',
      description: 'La puerta no cierra bien.',
      mediaIds: undefined
    });
    expect(postReq.request.body.specialty).toBeUndefined();
    expect(postReq.request.body.photoKeys).toBeUndefined();
    expect(postReq.request.body.ownerUserId).toBeUndefined();

    postReq.flush({
      ...mockRequest,
      requestId: 'req-2222',
      specialty: Specialty.Carpentry,
      title: 'Reparar puerta',
      photos: []
    });

    expect(component.requests().length).toBe(1);
    expect(component.requests()[0].requestId).toBe('req-2222');
    expect(component.submitSuccess()).toContain('Especialidad detectada: Carpintería');
    expect(component.sending()).toBe(false);
  });

  it('debe procesar carga de fotos: ticket -> PUT binario sin Auth -> confirm -> READY -> POST con mediaIds', () => {
    initialize();

    const file1 = new File(['content-1'], 'foto1.jpg', { type: 'image/jpeg' });
    const event = {
      target: {
        files: [file1],
        value: 'fake-path'
      }
    } as unknown as Event;

    component.onFilesSelected(event);

    expect(component.photos().length).toBe(1);
    expect(component.photos()[0].status).toBe('UPLOADING');

    // 1. Solicitud de ticket
    const ticketReq = httpTesting.expectOne(`${environment.apiOrigin}/media/uploads`);
    expect(ticketReq.request.method).toBe('POST');
    expect(ticketReq.request.body).toEqual({
      purpose: 'REPAIR_REQUEST',
      contentType: 'image/jpeg',
      sizeBytes: file1.size
    });
    ticketReq.flush({
      mediaId: 'media-foto-1',
      method: 'PUT',
      uploadUrl: 'http://storage.local/upload-foto-1',
      headers: { 'Content-Type': 'image/jpeg' },
      expiresAt: '2026-09-20T12:00:00Z'
    });

    // 2. PUT binario sin Authorization
    const binaryReq = httpTesting.expectOne('http://storage.local/upload-foto-1');
    expect(binaryReq.request.method).toBe('PUT');
    expect(binaryReq.request.headers.has('Authorization')).toBe(false);
    expect(binaryReq.request.body).toBe(file1);
    binaryReq.flush('OK', { status: 200, statusText: 'OK' });

    // 3. Confirmación
    const confirmReq = httpTesting.expectOne(`${environment.apiOrigin}/media/uploads/media-foto-1/confirm`);
    expect(confirmReq.request.method).toBe('POST');
    confirmReq.flush({ mediaId: 'media-foto-1', status: 'READY' });

    expect(component.photos()[0].status).toBe('READY');
    expect(component.photos()[0].mediaId).toBe('media-foto-1');
    expect(component.allPhotosReady()).toBe(true);

    // 4. Enviar formulario
    component.form.setValue({
      propertyId: mockProperty.id!,
      title: 'Tubería rota',
      description: 'Fuga evidente en la pared.'
    });

    component.submit();

    const postReq = httpTesting.expectOne(`${environment.apiOrigin}/requests`);
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body).toEqual({
      propertyId: mockProperty.id,
      title: 'Tubería rota',
      description: 'Fuga evidente en la pared.',
      mediaIds: ['media-foto-1']
    });

    postReq.flush({
      ...mockRequest,
      requestId: 'req-with-photo',
      photos: [{ mediaId: 'media-foto-1', readUrl: 'http://storage/read1.jpg', readUrlExpiresAt: '2026-09-20' }]
    });

    expect(component.requests().length).toBe(1);
    expect(component.photos().length).toBe(0); // Limpio tras éxito
  });

  it('debe rechazar selección que exceda el máximo de 6 fotos', () => {
    initialize();

    const files = Array.from({ length: 7 }, (_, i) =>
      new File([`data-${i}`], `foto${i}.jpg`, { type: 'image/jpeg' })
    );

    const event = {
      target: {
        files,
        value: 'fake'
      }
    } as unknown as Event;

    component.onFilesSelected(event);

    expect(component.photos().length).toBe(0);
    expect(component.photoValidationError()).toContain('Máximo 6 fotos');
  });

  it('debe rechazar archivo con MIME inválido o tamaño mayor a 10MB', () => {
    initialize();

    const invalidFile = new File(['text'], 'doc.pdf', { type: 'application/pdf' });
    const event = {
      target: {
        files: [invalidFile],
        value: 'fake'
      }
    } as unknown as Event;

    component.onFilesSelected(event);
    expect(component.photos().length).toBe(0);
    expect(component.photoValidationError()).toContain('Solo se admiten imágenes JPEG, PNG y WebP');
  });

  it('debe permitir retirar una foto antes de enviar', () => {
    initialize();

    const file = new File(['data'], 'foto.jpg', { type: 'image/jpeg' });
    component.onFilesSelected({
      target: { files: [file], value: 'fake' }
    } as unknown as Event);

    // Cancelar/retirar
    const item = component.photos()[0];
    component.removePhoto(item);

    expect(component.photos().length).toBe(0);
    httpTesting.expectOne(`${environment.apiOrigin}/media/uploads`);
  });

  it('si falla POST /requests, conserva los mediaIds confirmados y no los vuelve a subir al reintentar', () => {
    initialize();

    const file = new File(['data'], 'foto.jpg', { type: 'image/jpeg' });
    component.onFilesSelected({
      target: { files: [file], value: 'fake' }
    } as unknown as Event);

    // Flujo completo de carga exitosa del archivo
    httpTesting.expectOne(`${environment.apiOrigin}/media/uploads`).flush({
      mediaId: 'media-id-saved',
      method: 'PUT',
      uploadUrl: 'http://storage.local/upload-save',
      headers: { 'Content-Type': 'image/jpeg' },
      expiresAt: '2026-09-20'
    });
    httpTesting.expectOne('http://storage.local/upload-save').flush('OK');
    httpTesting.expectOne(`${environment.apiOrigin}/media/uploads/media-id-saved/confirm`).flush({
      mediaId: 'media-id-saved',
      status: 'READY'
    });

    expect(component.photos()[0].status).toBe('READY');
    expect(component.photos()[0].mediaId).toBe('media-id-saved');

    component.form.setValue({
      propertyId: mockProperty.id!,
      title: 'Problema en casa',
      description: 'Varios desperfectos.'
    });

    // 1. Intento de publicación falla con 500
    component.submit();

    const post1 = httpTesting.expectOne(`${environment.apiOrigin}/requests`);
    expect(post1.request.body.mediaIds).toEqual(['media-id-saved']);
    post1.flush(null, { status: 500, statusText: 'Internal Server Error' });

    expect(component.submitError()).toContain('No pudimos publicar la solicitud');
    // Las fotos y sus mediaIds se conservan sin alteración
    expect(component.photos().length).toBe(1);
    expect(component.photos()[0].status).toBe('READY');
    expect(component.photos()[0].mediaId).toBe('media-id-saved');

    // 2. Reintento: NO solicita tickets ni vuelve a hacer PUT binario
    component.submit();

    const post2 = httpTesting.expectOne(`${environment.apiOrigin}/requests`);
    expect(post2.request.body.mediaIds).toEqual(['media-id-saved']);
    post2.flush({
      ...mockRequest,
      requestId: 'req-success-after-retry'
    });

    expect(component.requests().length).toBe(1);
    expect(component.requests()[0].requestId).toBe('req-success-after-retry');
    expect(component.photos().length).toBe(0);
  });

  it('debe exigir una propiedad antes de crear una solicitud', () => {
    initialize();
    component.form.setValue({
      propertyId: '',
      title: 'Reparar puerta',
      description: 'La puerta no cierra bien.'
    });

    component.submit();

    expect(component.form.controls.propertyId.touched).toBe(true);
    expect(component.form.controls.propertyId.invalid).toBe(true);
    httpTesting.expectNone(`${environment.apiOrigin}/requests`);
  });

  it('preselecciona la propiedad solicitada cuando pertenece al owner', () => {
    requestedPropertyId = mockProperty.id!;
    initialize();

    expect(component.form.controls.propertyId.value).toBe(mockProperty.id);
  });

  it('no acepta un propertyId de la URL que no pertenece al owner', () => {
    requestedPropertyId = '550e8400-e29b-41d4-a716-446655440000';
    initialize();

    expect(component.form.controls.propertyId.value).toBe('');
  });

  it('no selecciona una propiedad automáticamente si la URL no tiene propertyId', () => {
    initialize();

    expect(component.form.controls.propertyId.value).toBe('');
  });

  it('permite cambiar manualmente la propiedad después de una preselección', () => {
    const anotherProperty: PropertySummary = {
      ...mockProperty,
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Casa familiar'
    };
    requestedPropertyId = mockProperty.id!;
    initialize([], [mockProperty, anotherProperty]);

    component.form.controls.propertyId.setValue(anotherProperty.id!);

    expect(component.form.controls.propertyId.value).toBe(anotherProperty.id);
  });

  it('TENANT carga sus solicitudes sin consultar propiedades y no muestra el formulario', () => {
    const element = initializeReadOnly('TENANT', [mockRequest]);

    expect(component.requests()).toEqual([mockRequest]);
    expect(element.textContent).toContain(mockRequest.title);
    expect(element.textContent).not.toContain('Nueva solicitud');
    expect(element.querySelector('form')).toBeNull();
  });

  it('TENANT ignora propertyId de la URL sin consultar propiedades ni preseleccionar', () => {
    requestedPropertyId = mockProperty.id!;
    initializeReadOnly('TENANT');

    expect(component.form.controls.propertyId.value).toBe('');
    expect(component.properties()).toEqual([]);
  });

  it('REAL_ESTATE_MANAGER carga sus solicitudes sin consultar propiedades ni mostrar creación', () => {
    const element = initializeReadOnly('REAL_ESTATE_MANAGER', [mockRequest]);

    expect(component.requests()).toEqual([mockRequest]);
    expect(element.textContent).not.toContain('Nueva solicitud');
    expect(element.querySelector('form')).toBeNull();
  });

  it('muestra un estado vacío neutral para roles de solo lectura', () => {
    const element = initializeReadOnly('TENANT');

    expect(element.textContent).toContain('No tienes solicitudes registradas.');
    expect(element.textContent).not.toContain('Registrar propiedad');
  });
});
