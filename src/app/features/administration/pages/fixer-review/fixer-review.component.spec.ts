import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FixerReviewComponent } from './fixer-review.component';
import { provideApi, ReviewResponse } from '../../../../api/generated';
import { environment } from '../../../../../environments/environment';

describe('FixerReviewComponent', () => {
  let component: FixerReviewComponent;
  let httpTesting: HttpTestingController;

  const fixer = '11111111-1111-1111-1111-111111111111';

  const reviewUnderReview: ReviewResponse = {
    fixerUserId: fixer,
    status: 'PENDING',
    underReview: true,
    submittedAt: '2026-01-01T00:00:00Z',
    decidedAt: null,
    decidedBy: null,
    rejectionReason: null,
    specialties: new Set(['PLUMBING']),
    documents: [
      {
        type: 'ID_CARD',
        mediaId: '22222222-2222-2222-2222-222222222222',
        readUrl: 'https://storage.example.com/verification/id-card.jpg?signature=abc',
        readUrlExpiresAt: '2026-01-01T00:05:00Z'
      }
    ]
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FixerReviewComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideApi(environment.apiOrigin)]
    });
    component = TestBed.createComponent(FixerReviewComponent).componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('no debe permitir buscar sin identificador del técnico', () => {
    component.fixerUserId = '   ';

    expect(component.puedeBuscar()).toBe(false);
    httpTesting.expectNone(() => true);
  });

  it('no debe permitir decidir antes de cargar la revisión', () => {
    component.fixerUserId = fixer;

    expect(component.puedeDecidir()).toBe(false);

    component.aprobar();
    component.motivo = 'Documentos ilegibles';
    component.rechazar();

    httpTesting.expectNone(() => true);
  });

  it('debe cargar la revisión y habilitar aprobar; exigir motivo para rechazar', () => {
    component.fixerUserId = fixer;
    component.cargarRevision();

    const req = httpTesting.expectOne(`${environment.apiOrigin}/fixers/${fixer}/verification`);
    expect(req.request.method).toBe('GET');
    req.flush(reviewUnderReview);

    expect(component.review()).toEqual(reviewUnderReview);
    expect(component.puedeDecidir()).toBe(true);
    expect(component.puedeRechazar()).toBe(false);

    component.motivo = 'Documentos ilegibles';
    expect(component.puedeRechazar()).toBe(true);
  });

  it('no debe habilitar la decisión si el perfil cargado no está en revisión', () => {
    component.fixerUserId = fixer;
    component.cargarRevision();

    httpTesting
      .expectOne(`${environment.apiOrigin}/fixers/${fixer}/verification`)
      .flush({ ...reviewUnderReview, status: 'VERIFIED', underReview: false });

    expect(component.puedeDecidir()).toBe(false);

    component.aprobar();
    httpTesting.expectNone(() => true);
  });

  it('debe invalidar la revisión cargada si el identificador cambia', () => {
    component.fixerUserId = fixer;
    component.cargarRevision();
    httpTesting.expectOne(`${environment.apiOrigin}/fixers/${fixer}/verification`).flush(reviewUnderReview);

    expect(component.puedeDecidir()).toBe(true);

    component.fixerUserId = '33333333-3333-3333-3333-333333333333';

    expect(component.review()).toBeNull();
    expect(component.puedeDecidir()).toBe(false);
  });

  it('debe explicar un fixerUserId sin perfil de técnico', () => {
    component.fixerUserId = fixer;
    component.cargarRevision();

    httpTesting
      .expectOne(`${environment.apiOrigin}/fixers/${fixer}/verification`)
      .flush(null, { status: 404, statusText: 'Not Found' });

    expect(component.reviewError()).toBe('No existe un perfil de técnico con ese identificador.');
  });

  it('debe aprobar enviando POST a la ruta del técnico y recargar la revisión', () => {
    component.fixerUserId = fixer;
    component.cargarRevision();
    httpTesting.expectOne(`${environment.apiOrigin}/fixers/${fixer}/verification`).flush(reviewUnderReview);

    component.aprobar();

    const req = httpTesting.expectOne(`${environment.apiOrigin}/fixers/${fixer}/verification/approve`);
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(component.exito()).toBe('El técnico quedó verificado.');
    expect(component.procesando()).toBe(false);

    // Tras la decisión, la pantalla recarga la revisión para no permitir decidir dos veces.
    httpTesting
      .expectOne(`${environment.apiOrigin}/fixers/${fixer}/verification`)
      .flush({ ...reviewUnderReview, status: 'VERIFIED', underReview: false });

    expect(component.puedeDecidir()).toBe(false);
  });

  it('debe rechazar enviando el motivo recortado y limpiarlo al terminar', () => {
    component.fixerUserId = fixer;
    component.cargarRevision();
    httpTesting.expectOne(`${environment.apiOrigin}/fixers/${fixer}/verification`).flush(reviewUnderReview);

    component.motivo = '  Documentos ilegibles  ';
    component.rechazar();

    const req = httpTesting.expectOne(`${environment.apiOrigin}/fixers/${fixer}/verification/reject`);
    expect(req.request.body).toEqual({ reason: 'Documentos ilegibles' });
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(component.motivo).toBe('');
    expect(component.exito()).toContain('rechazada');

    httpTesting
      .expectOne(`${environment.apiOrigin}/fixers/${fixer}/verification`)
      .flush({ ...reviewUnderReview, status: 'REJECTED', underReview: false, rejectionReason: 'Documentos ilegibles' });
  });

  it('debe explicar la auto-revisión', () => {
    component.fixerUserId = fixer;
    component.cargarRevision();
    httpTesting.expectOne(`${environment.apiOrigin}/fixers/${fixer}/verification`).flush(reviewUnderReview);

    component.aprobar();

    httpTesting
      .expectOne(`${environment.apiOrigin}/fixers/${fixer}/verification/approve`)
      .flush({ code: 'SELF_REVIEW' }, { status: 409, statusText: 'Conflict' });

    expect(component.error()).toBe('Un administrador no puede decidir su propia verificación.');
  });

  it('debe explicar la falta de privilegios administrativos', () => {
    component.fixerUserId = fixer;
    component.cargarRevision();
    httpTesting.expectOne(`${environment.apiOrigin}/fixers/${fixer}/verification`).flush(reviewUnderReview);

    component.aprobar();

    httpTesting
      .expectOne(`${environment.apiOrigin}/fixers/${fixer}/verification/approve`)
      .flush({ code: 'ACCESS_DENIED' }, { status: 403, statusText: 'Forbidden' });

    expect(component.error()).toBe('Tu cuenta no tiene privilegios de administrador vigentes.');
  });
});
