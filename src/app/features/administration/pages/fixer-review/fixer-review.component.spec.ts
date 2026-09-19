import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FixerReviewComponent } from './fixer-review.component';
import { provideApi } from '../../../../api/generated';
import { environment } from '../../../../../environments/environment';

describe('FixerReviewComponent', () => {
  let component: FixerReviewComponent;
  let httpTesting: HttpTestingController;

  const fixer = '11111111-1111-1111-1111-111111111111';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FixerReviewComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideApi(environment.apiOrigin)]
    });
    component = TestBed.createComponent(FixerReviewComponent).componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('no debe permitir decidir sin identificador del técnico', () => {
    component.fixerUserId = '   ';
    component.aprobar();

    httpTesting.expectNone(() => true);
    expect(component.puedeDecidir()).toBe(false);
  });

  it('debe exigir un motivo para rechazar pero no para aprobar', () => {
    component.fixerUserId = fixer;

    expect(component.puedeDecidir()).toBe(true);
    expect(component.puedeRechazar()).toBe(false);

    component.motivo = 'Documentos ilegibles';
    expect(component.puedeRechazar()).toBe(true);
  });

  it('debe aprobar enviando POST a la ruta del técnico', () => {
    component.fixerUserId = fixer;
    component.aprobar();

    const req = httpTesting.expectOne(`${environment.apiOrigin}/fixers/${fixer}/verification/approve`);
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(component.exito()).toBe('El técnico quedó verificado.');
    expect(component.procesando()).toBe(false);
  });

  it('debe rechazar enviando el motivo recortado y limpiarlo al terminar', () => {
    component.fixerUserId = fixer;
    component.motivo = '  Documentos ilegibles  ';
    component.rechazar();

    const req = httpTesting.expectOne(`${environment.apiOrigin}/fixers/${fixer}/verification/reject`);
    expect(req.request.body).toEqual({ reason: 'Documentos ilegibles' });
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(component.motivo).toBe('');
    expect(component.exito()).toContain('rechazada');
  });

  it('debe explicar la auto-revisión', () => {
    component.fixerUserId = fixer;
    component.aprobar();

    httpTesting
      .expectOne(`${environment.apiOrigin}/fixers/${fixer}/verification/approve`)
      .flush({ code: 'SELF_REVIEW' }, { status: 409, statusText: 'Conflict' });

    expect(component.error()).toBe('Un administrador no puede decidir su propia verificación.');
  });

  it('debe explicar que no hay entrega esperando decisión', () => {
    component.fixerUserId = fixer;
    component.aprobar();

    httpTesting
      .expectOne(`${environment.apiOrigin}/fixers/${fixer}/verification/approve`)
      .flush({ code: 'NOT_UNDER_REVIEW' }, { status: 409, statusText: 'Conflict' });

    expect(component.error()).toBe('Ese técnico no tiene una entrega esperando decisión.');
  });

  it('debe explicar la falta de privilegios administrativos', () => {
    component.fixerUserId = fixer;
    component.aprobar();

    httpTesting
      .expectOne(`${environment.apiOrigin}/fixers/${fixer}/verification/approve`)
      .flush({ code: 'ACCESS_DENIED' }, { status: 403, statusText: 'Forbidden' });

    expect(component.error()).toBe('Tu cuenta no tiene privilegios de administrador vigentes.');
  });
});
