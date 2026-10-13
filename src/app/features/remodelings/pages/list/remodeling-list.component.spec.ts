import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import {
  ProjectSummaryResponse,
  RemodelingProgressStatus,
  provideApi
} from '../../../../api/generated';
import { RemodelingStore } from '../../services/remodeling.store';
import { RemodelingListComponent } from './remodeling-list.component';

describe('RemodelingListComponent', () => {
  let fixture: ComponentFixture<RemodelingListComponent>;
  let component: RemodelingListComponent;
  let httpTesting: HttpTestingController;

  const mockProject: ProjectSummaryResponse = {
    id: 'proj-123',
    propertyId: 'prop-abc',
    title: 'Remodelación integral primer piso',
    progressStatus: RemodelingProgressStatus.Open,
    requirementCount: 3,
    assignedCount: 1,
    completedCount: 0,
    createdAt: '2026-10-13T10:00:00Z'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [RemodelingListComponent],
      providers: [
        RemodelingStore,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApi(environment.apiOrigin)
      ]
    });

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RemodelingListComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.verify();
    fixture?.destroy();
  });

  function initialize(projects: ProjectSummaryResponse[] = [mockProject]): void {
    fixture.detectChanges();
    const req = httpTesting.expectOne(`${environment.apiOrigin}/remodelings/me`);
    expect(req.request.method).toBe('GET');
    req.flush(projects);
    fixture.detectChanges();
  }

  it('muestra estado de carga mientras se consultan las remodelaciones', () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne(`${environment.apiOrigin}/remodelings/me`);

    expect(component.store.loading()).toBe(true);
    expect(fixture.nativeElement.querySelector('.loading-state')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Cargando proyectos de remodelación');

    req.flush([]);
    fixture.detectChanges();
    expect(component.store.loading()).toBe(false);
  });

  it('muestra el estado vacío cuando el propietario no tiene proyectos', () => {
    initialize([]);

    expect(component.store.projects()).toEqual([]);
    const emptyState = fixture.nativeElement.querySelector('.empty-state');
    expect(emptyState).toBeTruthy();
    expect(emptyState.textContent).toContain('Aún no tienes proyectos de remodelación');
    expect(emptyState.querySelector('a')?.textContent).toContain('Nueva remodelación');
  });

  it('renderiza la lista de proyectos con datos reales del backend', () => {
    initialize();

    expect(component.store.projects().length).toBe(1);
    const cards = fixture.nativeElement.querySelectorAll('.project-card');
    expect(cards.length).toBe(1);

    const card = cards[0];
    expect(card.querySelector('.card-title')?.textContent).toContain('Remodelación integral primer piso');
    expect(card.querySelector('.property-ref')?.textContent).toContain('prop-abc');
    expect(card.querySelector('.status-badge')?.textContent).toContain('Abierta');

    const counterNums = card.querySelectorAll('.counter-num');
    expect(counterNums[0]?.textContent).toBe('3'); // requirementCount
    expect(counterNums[1]?.textContent).toBe('1'); // assignedCount
    expect(counterNums[2]?.textContent).toBe('0'); // completedCount

    const viewLink = card.querySelector('.view-link') as HTMLAnchorElement;
    expect(viewLink.getAttribute('href')).toBe('/remodelings/proj-123');
  });

  it('muestra error y permite reintentar ante fallo del servidor', () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne(`${environment.apiOrigin}/remodelings/me`);
    req.flush(null, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(component.store.error()).toContain('No pudimos cargar tus remodelaciones');
    const errorState = fixture.nativeElement.querySelector('.error-state');
    expect(errorState).toBeTruthy();

    const retryBtn = errorState.querySelector('button') as HTMLButtonElement;
    retryBtn.click();

    const retryReq = httpTesting.expectOne(`${environment.apiOrigin}/remodelings/me`);
    retryReq.flush([mockProject]);
    fixture.detectChanges();

    expect(component.store.projects().length).toBe(1);
  });
});
