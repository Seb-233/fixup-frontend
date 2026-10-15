import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import {
  CreateProjectRequest,
  PaymentMethod,
  ProjectResponse,
  ProjectSummaryResponse,
  RemodelingProgressStatus,
  RepairRequestStatus,
  Specialty,
  provideApi
} from '../../../api/generated';
import { RemodelingStore } from './remodeling.store';

describe('RemodelingStore', () => {
  let store: RemodelingStore;
  let httpTesting: HttpTestingController;

  const mockProjectSummary: ProjectSummaryResponse = {
    id: 'proj-1',
    propertyId: 'prop-1',
    title: 'Remodelación de Cocina',
    progressStatus: RemodelingProgressStatus.Open,
    requirementCount: 2,
    assignedCount: 0,
    completedCount: 0,
    createdAt: '2026-10-13T10:00:00Z'
  };

  const mockProjectDetail: ProjectResponse = {
    id: 'proj-1',
    propertyId: 'prop-1',
    ownerUserId: 'owner-1',
    title: 'Remodelación de Cocina',
    description: 'Renovación completa de tuberías y azulejos',
    status: RemodelingProgressStatus.Open,
    requirementCount: 2,
    assignedCount: 0,
    completedCount: 0,
    createdAt: '2026-10-13T10:00:00Z',
    updatedAt: '2026-10-13T10:00:00Z',
    requirements: [
      {
        requirementId: 'req-1',
        requestId: 'rep-req-1',
        position: 1,
        specialty: Specialty.Plumbing,
        requestStatus: RepairRequestStatus.Open,
        assignedFixerUserId: null,
        jobId: null,
        paymentMethod: PaymentMethod.Transfer
      },
      {
        requirementId: 'req-2',
        requestId: 'rep-req-2',
        position: 2,
        specialty: Specialty.Masonry,
        requestStatus: RepairRequestStatus.Open,
        assignedFixerUserId: null,
        jobId: null,
        paymentMethod: PaymentMethod.Cash
      }
    ]
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        RemodelingStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApi(environment.apiOrigin)
      ]
    });

    store = TestBed.inject(RemodelingStore);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('loadProjects consulta GET /remodelings/me y actualiza projects signal', () => {
    store.loadProjects().subscribe();

    expect(store.loading()).toBe(true);

    const req = httpTesting.expectOne(`${environment.apiOrigin}/remodelings/me`);
    expect(req.request.method).toBe('GET');
    req.flush([mockProjectSummary]);

    expect(store.loading()).toBe(false);
    expect(store.projects()).toEqual([mockProjectSummary]);
    expect(store.error()).toBeNull();
  });

  it('loadProjects mapea error 403 correctamente', () => {
    store.loadProjects().subscribe();

    const req = httpTesting.expectOne(`${environment.apiOrigin}/remodelings/me`);
    req.flush({ code: 'FORBIDDEN' }, { status: 403, statusText: 'Forbidden' });

    expect(store.loading()).toBe(false);
    expect(store.error()).toBe('No tienes autorización para realizar esta operación.');
  });

  it('loadDetail consulta GET /remodelings/{projectId} y actualiza selectedProject', () => {
    store.loadDetail('proj-1').subscribe();

    expect(store.loading()).toBe(true);

    const req = httpTesting.expectOne(`${environment.apiOrigin}/remodelings/proj-1`);
    expect(req.request.method).toBe('GET');
    req.flush(mockProjectDetail);

    expect(store.loading()).toBe(false);
    expect(store.selectedProject()).toEqual(mockProjectDetail);
    expect(store.error()).toBeNull();
  });

  it('loadDetail maneja 404 si el proyecto no existe', () => {
    store.loadDetail('proj-999').subscribe();

    const req = httpTesting.expectOne(`${environment.apiOrigin}/remodelings/proj-999`);
    req.flush({ code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });

    expect(store.loading()).toBe(false);
    expect(store.selectedProject()).toBeNull();
    expect(store.error()).toBe('El recurso solicitado no fue encontrado.');
  });

  it('createProject envía POST /remodelings y actualiza selectedProject', () => {
    const payload: CreateProjectRequest = {
      propertyId: 'prop-1',
      title: 'Nueva Remodelación',
      requirements: [
        {
          title: 'Arreglar fuga',
          description: 'Fuga bajo el lavaplatos',
          urgencyLevel: 'HIGH',
          mediaIds: [],
          paymentMethod: PaymentMethod.Transfer
        }
      ]
    };

    store.createProject(payload).subscribe();

    expect(store.loading()).toBe(true);

    const req = httpTesting.expectOne(`${environment.apiOrigin}/remodelings`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(mockProjectDetail);

    expect(store.loading()).toBe(false);
    expect(store.selectedProject()).toEqual(mockProjectDetail);
    expect(store.error()).toBeNull();
  });
});
