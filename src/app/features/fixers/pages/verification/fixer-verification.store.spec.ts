import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FixerVerificationStore } from './fixer-verification.store';
import { provideApi, Specialty, VerificationResponse } from '../../../../api/generated';
import { environment } from '../../../../../environments/environment';

describe('FixerVerificationStore', () => {
  let store: FixerVerificationStore;
  let httpTesting: HttpTestingController;

  const pendiente: VerificationResponse = {
    status: 'PENDING',
    underReview: false,
    submittedAt: null,
    decidedAt: null,
    rejectionReason: null,
    submittedDocuments: new Set(['ID_CARD']),
    missingDocuments: new Set(['TRADE_CERTIFICATE']),
    specialties: new Set(['PLUMBING' as Specialty])
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FixerVerificationStore,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApi(environment.apiOrigin)
      ]
    });
    store = TestBed.inject(FixerVerificationStore);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('debe cargar el estado propio y separar documentos entregados, pendientes y especialidades', () => {
    store.load();

    const req = httpTesting.expectOne(`${environment.apiOrigin}/fixers/me/verification`);
    expect(req.request.method).toBe('GET');
    req.flush(pendiente);

    expect(store.submittedDocuments()).toEqual(['ID_CARD']);
    expect(store.missingDocuments()).toEqual(['TRADE_CERTIFICATE']);
    expect(store.specialties()).toEqual(['PLUMBING']);
    expect(store.verified()).toBe(false);
    expect(store.loading()).toBe(false);
  });

  it('debe enviar solo la clave de almacenamiento en documentos, nunca el archivo', () => {
    store.submit([{ type: 'ID_CARD', storageKey: 'fixers/verificacion/cedula.pdf' }]);

    const req = httpTesting.expectOne(`${environment.apiOrigin}/fixers/me/verification/documents`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      documents: [{ type: 'ID_CARD', storageKey: 'fixers/verificacion/cedula.pdf' }]
    });
    expect(JSON.stringify(req.request.body)).not.toContain('content');
    req.flush({ ...pendiente, underReview: true });

    expect(store.underReview()).toBe(true);
  });

  it('debe actualizar especialidades con valores válidos del enum y actualizar el estado', () => {
    store.updateSpecialties([Specialty.Plumbing, Specialty.Electrical]);

    const req = httpTesting.expectOne(`${environment.apiOrigin}/fixers/me/specialties`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      specialties: [Specialty.Plumbing, Specialty.Electrical]
    });
    req.flush({
      ...pendiente,
      specialties: new Set([Specialty.Plumbing, Specialty.Electrical])
    });

    expect(store.specialties()).toEqual([Specialty.Plumbing, Specialty.Electrical]);
    expect(store.submitting()).toBe(false);
  });

  it('debe rechazar la actualización de especialidades si la lista está vacía', () => {
    store.updateSpecialties([]);

    httpTesting.expectNone(() => true);
    expect(store.error()).toBe('Debes seleccionar al menos una especialidad.');
  });

  it('debe reflejar la revisión abierta y el estado verificado', () => {
    store.load();
    httpTesting
      .expectOne(`${environment.apiOrigin}/fixers/me/verification`)
      .flush({ ...pendiente, status: 'VERIFIED', missingDocuments: new Set() });

    expect(store.verified()).toBe(true);
  });

  it('debe traducir el conflicto ALREADY_VERIFIED a un mensaje para el usuario', () => {
    store.submit([{ type: 'ID_CARD', storageKey: 'clave' }]);

    httpTesting
      .expectOne(`${environment.apiOrigin}/fixers/me/verification/documents`)
      .flush({ code: 'ALREADY_VERIFIED' }, { status: 409, statusText: 'Conflict' });

    expect(store.error()).toBe('Tu perfil ya está verificado.');
    expect(store.submitting()).toBe(false);
  });

  it('debe traducir el 403 del técnico sin rol activo', () => {
    store.load();

    httpTesting
      .expectOne(`${environment.apiOrigin}/fixers/me/verification`)
      .flush({ code: 'ACCESS_DENIED' }, { status: 403, statusText: 'Forbidden' });

    expect(store.error()).toBe('Tu cuenta no tiene el rol de técnico activo.');
  });

  it('debe traducir el 401 si la sesión expira', () => {
    store.load();

    httpTesting
      .expectOne(`${environment.apiOrigin}/fixers/me/verification`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(store.error()).toBe('Sesión expirada o no autenticada. Inicia sesión nuevamente.');
  });

  it('debe traducir el 404 si el perfil no existe', () => {
    store.load();

    httpTesting
      .expectOne(`${environment.apiOrigin}/fixers/me/verification`)
      .flush(null, { status: 404, statusText: 'Not Found' });

    expect(store.error()).toBe('Perfil de técnico no encontrado.');
  });

  it('debe usar un mensaje genérico ante un error desconocido y no exponer detalles internos', () => {
    store.load();

    httpTesting
      .expectOne(`${environment.apiOrigin}/fixers/me/verification`)
      .flush({ detalle: 'stack trace interno' }, { status: 500, statusText: 'Server Error' });

    expect(store.error()).toBe('No se pudo completar la operación. Inténtalo de nuevo.');
    expect(store.error()).not.toContain('stack');
  });
});
