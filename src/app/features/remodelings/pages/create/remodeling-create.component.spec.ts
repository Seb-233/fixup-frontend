import { HttpResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import {
  CreateProjectRequest,
  ProjectResponse,
  PropertySummary,
  RemodelingProgressStatus,
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

  function initialize(properties: PropertySummary[] = [mockProperty]): void {
    fixture.detectChanges();
    const req = httpTesting.expectOne(`${environment.apiOrigin}/properties/me`);
    expect(req.request.method).toBe('GET');
    req.flush(properties);
    fixture.detectChanges();
  }

  it('carga las propiedades propias del OWNER al iniciar', () => {
    initialize();

    expect(component.loadingProperties()).toBe(false);
    expect(component.properties()).toEqual([mockProperty]);
    const select = fixture.nativeElement.querySelector('#select-property') as HTMLSelectElement;
    expect(select.options.length).toBe(2); // placeholder + 1 property
  });

  it('inicia con exactamente 1 necesidad y permite añadir más', () => {
    initialize();

    expect(component.requirementsArray.length).toBe(1);

    component.addRequirement();
    expect(component.requirementsArray.length).toBe(2);

    component.addRequirement();
    expect(component.requirementsArray.length).toBe(3);
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

  it('valida campos obligatorios y no envía POST si el formulario es inválido', () => {
    initialize();

    component.submit();
    expect(component.form.invalid).toBe(true);
    httpTesting.expectNone(`${environment.apiOrigin}/remodelings`);
  });

  it('envía POST /remodelings con payload exacto (sin specialty) y navega al detalle en 201', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    initialize();

    component.form.patchValue({
      propertyId: 'prop-111',
      title: 'Remodelación integral',
      description: 'Renovación de cocina y baños'
    });

    // Primera necesidad
    component.requirementsArray.at(0).patchValue({
      title: 'Cambio de tubería',
      description: 'Reemplazo de tubería galvanizada por PVC',
      urgencyLevel: 'HIGH'
    });

    // Segunda necesidad
    component.addRequirement();
    component.requirementsArray.at(1).patchValue({
      title: 'Enchape cerámico',
      description: 'Instalar baldosa en paredes y pisos',
      urgencyLevel: 'MEDIUM'
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
          mediaIds: []
        },
        {
          title: 'Enchape cerámico',
          description: 'Instalar baldosa en paredes y pisos',
          urgencyLevel: 'MEDIUM',
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

  it('respeta el límite contractual de seis fotos por necesidad', () => {
    initialize();

    let sequence = 0;
    const file = new File(['fake-img'], 'soporte.jpg', { type: 'image/jpeg' });
    vi.spyOn(mediaService, 'validateFile').mockReturnValue({ valid: true });
    vi.spyOn(mediaService, 'requestUploadTicket').mockImplementation(() => {
      const mediaId = `media-${++sequence}`;
      return of({
        mediaId,
        uploadUrl: 'http://storage/test',
        method: 'PUT',
        headers: {},
        expiresAt: '2026-10-13T12:00:00Z'
      });
    });
    vi.spyOn(mediaService, 'uploadBinary').mockReturnValue(of(new HttpResponse({ status: 200 })));
    vi.spyOn(mediaService, 'confirmUpload').mockImplementation((mediaId: string) =>
      of({ mediaId, status: 'CONFIRMED' })
    );

    for (let i = 0; i < 6; i++) {
      component.onFileSelected({ target: { files: [file], value: '' } } as never, 0);
    }

    expect(component.maxPhotos).toBe(6);
    expect(component.mediaState(0).mediaIds).toHaveLength(6);

    component.onFileSelected({ target: { files: [file], value: '' } } as never, 0);

    expect(component.mediaState(0).mediaIds).toHaveLength(6);
    expect(component.mediaState(0).error).toContain('Máximo 6 fotos');
  });

  it('no permite enviar ni eliminar necesidades mientras existe una carga de media en curso', () => {
    initialize();
    component.addRequirement();
    component.form.patchValue({
      propertyId: 'prop-111',
      title: 'Remodelación'
    });
    component.requirementsArray.at(0).patchValue({
      title: 'Pintura',
      description: 'Pintar sala',
      urgencyLevel: 'LOW'
    });
    component.requirementsArray.at(1).patchValue({
      title: 'Electricidad',
      description: 'Actualizar tomas',
      urgencyLevel: 'MEDIUM'
    });

    const pendingTicket = new Subject<any>();
    const file = new File(['fake-img'], 'pendiente.jpg', { type: 'image/jpeg' });
    vi.spyOn(mediaService, 'validateFile').mockReturnValue({ valid: true });
    vi.spyOn(mediaService, 'requestUploadTicket').mockReturnValue(pendingTicket);

    component.onFileSelected({ target: { files: [file], value: '' } } as never, 0);

    expect(component.hasUploadingMedia()).toBe(true);

    component.submit();
    httpTesting.expectNone(`${environment.apiOrigin}/remodelings`);

    component.removeRequirement(1);
    expect(component.requirementsArray.length).toBe(2);

    pendingTicket.complete();
  });

  it('muestra mensaje de error si el backend responde con fallo y conserva datos', () => {
    initialize();

    component.form.patchValue({
      propertyId: 'prop-111',
      title: 'Remodelación',
      description: 'Texto descriptivo'
    });
    component.requirementsArray.at(0).patchValue({
      title: 'Pintura',
      description: 'Pintar sala',
      urgencyLevel: 'LOW'
    });

    component.submit();

    const postReq = httpTesting.expectOne(`${environment.apiOrigin}/remodelings`);
    postReq.flush({ message: 'Conflicto' }, { status: 409, statusText: 'Conflict' });
    fixture.detectChanges();

    expect(component.submitError()).toContain('Conflicto al crear el proyecto');
    expect(component.form.get('title')?.value).toBe('Remodelación');
  });
});
