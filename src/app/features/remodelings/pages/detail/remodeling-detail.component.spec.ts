import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import {
  JobStatus,
  ProjectResponse,
  RemodelingProgressStatus,
  RepairRequestStatus,
  Specialty,
  provideApi
} from '../../../../api/generated';
import { RemodelingStore } from '../../services/remodeling.store';
import { RemodelingDetailComponent } from './remodeling-detail.component';

describe('RemodelingDetailComponent', () => {
  let fixture: ComponentFixture<RemodelingDetailComponent>;
  let component: RemodelingDetailComponent;
  let httpTesting: HttpTestingController;

  const mockProject: ProjectResponse = {
    id: 'proj-456',
    propertyId: 'prop-789',
    ownerUserId: 'owner-me',
    title: 'Remodelación Baño Principal',
    description: 'Cambio de sanitarios y azulejos',
    status: RemodelingProgressStatus.PartiallyAssigned,
    requirementCount: 2,
    assignedCount: 1,
    completedCount: 0,
    createdAt: '2026-10-13T10:00:00Z',
    updatedAt: '2026-10-13T11:00:00Z',
    requirements: [
      {
        requirementId: 'req-1',
        requestId: 'rep-req-open',
        position: 0,
        specialty: Specialty.Plumbing,
        requestStatus: RepairRequestStatus.Open,
        assignedFixerUserId: null,
        jobId: null,
        jobStatus: undefined
      },
      {
        requirementId: 'req-2',
        requestId: 'rep-req-assigned',
        position: 1,
        specialty: Specialty.Masonry,
        requestStatus: RepairRequestStatus.Assigned,
        assignedFixerUserId: 'fixer-john-doe',
        jobId: 'job-999',
        jobStatus: JobStatus.Assigned
      }
    ]
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RemodelingDetailComponent],
      providers: [
        RemodelingStore,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApi(environment.apiOrigin),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: (key: string) => (key === 'projectId' ? 'proj-456' : null)
              }
            }
          }
        }
      ]
    });

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RemodelingDetailComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
    fixture?.destroy();
  });

  function initialize(project: ProjectResponse = mockProject): void {
    fixture.detectChanges();
    const req = httpTesting.expectOne(`${environment.apiOrigin}/remodelings/proj-456`);
    expect(req.request.method).toBe('GET');
    req.flush(project);
    fixture.detectChanges();
  }

  it('carga y muestra la información del proyecto y su estado global', () => {
    initialize();

    expect(component.store.selectedProject()).toEqual(mockProject);
    const title = fixture.nativeElement.querySelector('h1');
    expect(title?.textContent).toContain('Remodelación Baño Principal');

    const statusBadge = fixture.nativeElement.querySelector('.title-row .status-badge');
    expect(statusBadge?.textContent).toContain('Parcialmente asignada');

    const metrics = fixture.nativeElement.querySelectorAll('.metric-num');
    expect(metrics[0]?.textContent).toBe('2'); // requirementCount
    expect(metrics[1]?.textContent).toBe('1'); // assignedCount
    expect(metrics[2]?.textContent).toBe('0'); // completedCount
  });

  it('renderiza todas las necesidades con sus datos devueltos por el backend', () => {
    initialize();

    const reqCards = fixture.nativeElement.querySelectorAll('.req-card');
    expect(reqCards.length).toBe(2);

    // Primera necesidad (Open, sin técnico)
    const card1 = reqCards[0];
    expect(card1.querySelector('.position-badge')?.textContent).toContain('#1');
    expect(card1.querySelector('.specialty-badge')?.textContent).toContain('Plomería');
    expect(card1.querySelector('.req-status-badge')?.textContent).toContain('Abierta');
    expect(card1.textContent).not.toContain('fixer-john-doe');

    // Segunda necesidad (Assigned, con técnico y trabajo)
    const card2 = reqCards[1];
    expect(card2.querySelector('.position-badge')?.textContent).toContain('#2');
    expect(card2.querySelector('.specialty-badge')?.textContent).toContain('Albañilería');
    expect(card2.querySelector('.req-status-badge')?.textContent).toContain('Asignada');
    expect(card2.textContent).toContain('fixer-john-doe');
    expect(card2.textContent).toContain('Asignado');
  });

  it('reutiliza los enlaces existentes a /requests y /quotations', () => {
    initialize();

    const linkReq1 = fixture.nativeElement.querySelector('#link-request-1') as HTMLAnchorElement;
    expect(linkReq1.getAttribute('href')).toBe('/requests/rep-req-open');

    const linkQuot1 = fixture.nativeElement.querySelector('#link-quotations-1') as HTMLAnchorElement;
    expect(linkQuot1.getAttribute('href')).toBe('/quotations/request/rep-req-open');

    const linkReq2 = fixture.nativeElement.querySelector('#link-request-2') as HTMLAnchorElement;
    expect(linkReq2.getAttribute('href')).toBe('/requests/rep-req-assigned');

    const linkQuot2 = fixture.nativeElement.querySelector('#link-quotations-2') as HTMLAnchorElement;
    expect(linkQuot2.getAttribute('href')).toBe('/quotations/request/rep-req-assigned');
  });

  it('muestra el enlace a conversación solo cuando el estado permite chat', () => {
    initialize();

    // Requisito 1 (OPEN): no debe tener enlace al chat
    const chatLink1 = fixture.nativeElement.querySelector('#link-chat-1');
    expect(chatLink1).toBeNull();

    // Requisito 2 (ASSIGNED): debe tener enlace a /requests/rep-req-assigned/messages
    const chatLink2 = fixture.nativeElement.querySelector('#link-chat-2') as HTMLAnchorElement;
    expect(chatLink2).toBeTruthy();
    expect(chatLink2.getAttribute('href')).toBe('/requests/rep-req-assigned/messages');
  });
});
