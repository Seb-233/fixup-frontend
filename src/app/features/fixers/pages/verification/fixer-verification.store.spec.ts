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

  const MEDIA_ID = '22222222-2222-2222-2222-222222222222';
  const UPLOAD_URL = 'https://storage.example.com/fixup-media/verification/abc.jpg?signature=xyz';

  function unFile(nombre = 'cedula.jpg', tipo = 'image/jpeg'): File {
    return new File(['contenido'], nombre, { type: tipo });
  }

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

  describe('uploadDocument', () => {
    it('debe encadenar ticket, subida binaria, confirmación y archivado con el mediaId confirmado', () => {
      store.uploadDocument('ID_CARD', unFile(), undefined);

      // Paso 1: pide el ticket firmado con el purpose correcto
      const ticketReq = httpTesting.expectOne(`${environment.apiOrigin}/media/uploads`);
      expect(ticketReq.request.method).toBe('POST');
      expect(ticketReq.request.body).toEqual({
        purpose: 'FIXER_VERIFICATION',
        contentType: 'image/jpeg',
        sizeBytes: 9
      });
      expect(store.uploadingType()).toBe('ID_CARD');
      expect(store.uploadStep()).toContain('autorización');

      ticketReq.flush({
        mediaId: MEDIA_ID,
        method: 'PUT',
        uploadUrl: UPLOAD_URL,
        headers: { 'Content-Type': 'image/jpeg' },
        expiresAt: '2026-01-01T00:15:00Z'
      });

      // Paso 2: sube el binario directo a la URL firmada, no a una ruta del backend de FixUp
      const putReq = httpTesting.expectOne(UPLOAD_URL);
      expect(putReq.request.method).toBe('PUT');
      expect(putReq.request.headers.get('Content-Type')).toBe('image/jpeg');
      expect(store.uploadStep()).toContain('almacenamiento');

      putReq.flush('', { status: 200, statusText: 'OK' });

      // Paso 3: confirma la subida contra el mediaId del ticket
      const confirmReq = httpTesting.expectOne(`${environment.apiOrigin}/media/uploads/${MEDIA_ID}/confirm`);
      expect(confirmReq.request.method).toBe('POST');
      expect(store.uploadStep()).toContain('Confirmando');

      confirmReq.flush({ mediaId: MEDIA_ID, status: 'READY' });

      // Paso 4: archiva el documento con el mediaId ya confirmado (nunca con un storageKey)
      const submitReq = httpTesting.expectOne(`${environment.apiOrigin}/fixers/me/verification/documents`);
      expect(submitReq.request.method).toBe('POST');
      expect(submitReq.request.body).toEqual({
        documents: [{ type: 'ID_CARD', mediaId: MEDIA_ID }]
      });
      expect(JSON.stringify(submitReq.request.body)).not.toContain('storageKey');

      submitReq.flush({ ...pendiente, underReview: true });

      expect(store.underReview()).toBe(true);
      expect(store.uploadingType()).toBeNull();
      expect(store.uploadStep()).toBeNull();
    });

    it('debe incluir consentVersion solo cuando se aceptó el consentimiento', () => {
      store.uploadDocument('ID_CARD', unFile(), 'v1.0');

      httpTesting
        .expectOne(`${environment.apiOrigin}/media/uploads`)
        .flush({ mediaId: MEDIA_ID, method: 'PUT', uploadUrl: UPLOAD_URL, headers: {}, expiresAt: '2026-01-01T00:15:00Z' });
      httpTesting.expectOne(UPLOAD_URL).flush('', { status: 200, statusText: 'OK' });
      httpTesting
        .expectOne(`${environment.apiOrigin}/media/uploads/${MEDIA_ID}/confirm`)
        .flush({ mediaId: MEDIA_ID, status: 'READY' });

      const submitReq = httpTesting.expectOne(`${environment.apiOrigin}/fixers/me/verification/documents`);
      expect(submitReq.request.body).toEqual({
        documents: [{ type: 'ID_CARD', mediaId: MEDIA_ID }],
        consentVersion: 'v1.0'
      });
      submitReq.flush(pendiente);
    });

    it('debe ignorar una segunda subida mientras la primera sigue en curso', () => {
      store.uploadDocument('ID_CARD', unFile(), undefined);
      store.uploadDocument('TRADE_CERTIFICATE', unFile('certificado.png', 'image/png'), undefined);

      // Solo debe existir una llamada de ticket en curso: la segunda invocación no hizo nada
      httpTesting.expectOne(`${environment.apiOrigin}/media/uploads`);
      expect(store.uploadingType()).toBe('ID_CARD');
    });

    it('debe traducir un 415 al pedir el ticket como formato no permitido', () => {
      store.uploadDocument('ID_CARD', unFile(), undefined);

      httpTesting
        .expectOne(`${environment.apiOrigin}/media/uploads`)
        .flush({ code: 'MEDIA_TYPE_NOT_ALLOWED' }, { status: 415, statusText: 'Unsupported Media Type' });

      expect(store.uploadError()).toBe('Formato de archivo no permitido. Solo se admiten imágenes JPEG, PNG o WebP.');
      expect(store.uploadingType()).toBeNull();
    });

    it('debe fallar con un mensaje propio si la subida binaria al almacenamiento falla', () => {
      store.uploadDocument('ID_CARD', unFile(), undefined);

      httpTesting
        .expectOne(`${environment.apiOrigin}/media/uploads`)
        .flush({ mediaId: MEDIA_ID, method: 'PUT', uploadUrl: UPLOAD_URL, headers: {}, expiresAt: '2026-01-01T00:15:00Z' });

      httpTesting.expectOne(UPLOAD_URL).flush('error', { status: 500, statusText: 'Server Error' });

      expect(store.uploadError()).toBe('No pudimos subir el archivo al almacenamiento. Intenta de nuevo.');
      expect(store.uploadingType()).toBeNull();
    });

    it('debe traducir CONSENT_REQUIRED al archivar el documento que completa el conjunto obligatorio', () => {
      store.uploadDocument('TRADE_CERTIFICATE', unFile(), undefined);

      httpTesting
        .expectOne(`${environment.apiOrigin}/media/uploads`)
        .flush({ mediaId: MEDIA_ID, method: 'PUT', uploadUrl: UPLOAD_URL, headers: {}, expiresAt: '2026-01-01T00:15:00Z' });
      httpTesting.expectOne(UPLOAD_URL).flush('', { status: 200, statusText: 'OK' });
      httpTesting
        .expectOne(`${environment.apiOrigin}/media/uploads/${MEDIA_ID}/confirm`)
        .flush({ mediaId: MEDIA_ID, status: 'READY' });

      httpTesting
        .expectOne(`${environment.apiOrigin}/fixers/me/verification/documents`)
        .flush({ code: 'CONSENT_REQUIRED' }, { status: 409, statusText: 'Conflict' });

      expect(store.uploadError()).toBe(
        'Debes aceptar el tratamiento de tus datos personales para completar la verificación.'
      );
      expect(store.uploadingType()).toBeNull();
    });
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
    store.uploadDocument('ID_CARD', unFile(), undefined);

    httpTesting
      .expectOne(`${environment.apiOrigin}/media/uploads`)
      .flush({ mediaId: MEDIA_ID, method: 'PUT', uploadUrl: UPLOAD_URL, headers: {}, expiresAt: '2026-01-01T00:15:00Z' });
    httpTesting.expectOne(UPLOAD_URL).flush('', { status: 200, statusText: 'OK' });
    httpTesting
      .expectOne(`${environment.apiOrigin}/media/uploads/${MEDIA_ID}/confirm`)
      .flush({ mediaId: MEDIA_ID, status: 'READY' });

    httpTesting
      .expectOne(`${environment.apiOrigin}/fixers/me/verification/documents`)
      .flush({ code: 'ALREADY_VERIFIED' }, { status: 409, statusText: 'Conflict' });

    expect(store.uploadError()).toBe('Tu perfil ya está verificado.');
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
