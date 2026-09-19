import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PortfolioComponent } from './portfolio.component';
import { PortfolioService } from './portfolio.service';
import {
  OwnPortfolioResponse,
  PieceResponse,
  provideApi
} from '../../../../api/generated';
import { environment } from '../../../../../environments/environment';

describe('PortfolioComponent (Carga Segura de Medios y Gestión de Portafolio)', () => {
  let component: PortfolioComponent;
  let service: PortfolioService;
  let httpTesting: HttpTestingController;

  const mockPiece1: PieceResponse = {
    id: 'p-1111',
    mediaId: 'm-1111',
    title: 'Baño remodelado',
    description: 'Enchape porcelanato',
    position: 1,
    visibility: 'PUBLIC',
    readUrl: 'http://storage.internal/fixup-media/p1.jpg?token=read1',
    readUrlExpiresAt: '2026-09-20T10:00:00Z',
    createdAt: '2026-09-19T08:00:00Z'
  };

  const mockPiece2: PieceResponse = {
    id: 'p-2222',
    mediaId: 'm-2222',
    title: 'Cocina integral',
    position: 2,
    visibility: 'PUBLIC',
    readUrl: 'http://storage.internal/fixup-media/p2.jpg?token=read2',
    readUrlExpiresAt: '2026-09-20T10:00:00Z'
  };

  const mockPiece3: PieceResponse = {
    id: 'p-3333',
    mediaId: 'm-3333',
    title: 'Instalación eléctrica',
    position: 3,
    visibility: 'PUBLIC',
    readUrl: 'http://storage.internal/fixup-media/p3.jpg?token=read3',
    readUrlExpiresAt: '2026-09-20T10:00:00Z'
  };

  const initialPortfolio: OwnPortfolioResponse = {
    fixerUserId: 'fixer-uuid-1',
    status: 'DRAFT',
    publishedAt: null,
    pieces: [mockPiece1, mockPiece2]
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PortfolioComponent],
      providers: [
        PortfolioService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApi(environment.apiOrigin)
      ]
    });
    component = TestBed.createComponent(PortfolioComponent).componentInstance;
    service = TestBed.inject(PortfolioService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('debe cargar el portafolio propio al inicializar', () => {
    component.ngOnInit();

    const req = httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio`);
    expect(req.request.method).toBe('GET');
    req.flush(initialPortfolio);

    expect(component.portfolio()?.fixerUserId).toBe('fixer-uuid-1');
    expect(component.piezas().length).toBe(2);
    expect(component.visiblePieces().length).toBe(2);
    expect(component.cargando()).toBe(false);
  });

  it('solo debe aceptar formatos MIME JPEG, PNG y WebP', () => {
    const validJpeg = new File(['data'], 'test.jpg', { type: 'image/jpeg' });
    const validPng = new File(['data'], 'test.png', { type: 'image/png' });
    const validWebp = new File(['data'], 'test.webp', { type: 'image/webp' });
    const invalidGif = new File(['data'], 'test.gif', { type: 'image/gif' });
    const invalidVideo = new File(['data'], 'test.mp4', { type: 'video/mp4' });

    expect(service.validateFile(validJpeg).valid).toBe(true);
    expect(service.validateFile(validPng).valid).toBe(true);
    expect(service.validateFile(validWebp).valid).toBe(true);

    const checkGif = service.validateFile(invalidGif);
    expect(checkGif.valid).toBe(false);
    expect(checkGif.error).toContain('Solo se admiten imágenes JPEG, PNG y WebP');

    const checkVideo = service.validateFile(invalidVideo);
    expect(checkVideo.valid).toBe(false);
  });

  it('debe completar el flujo seguro: ticket -> PUT binario sin Auth -> confirm -> addPiece con mediaId', () => {
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio`).flush(initialPortfolio);

    const testFile = new File(['binary-content'], 'foto.jpg', { type: 'image/jpeg' });
    component.titulo = 'Nuevo proyecto';
    component.descripcion = 'Descripción del proyecto';
    component.archivoSeleccionado.set(testFile);

    component.iniciarSubida();

    // 1. Solicitud de ticket al backend
    const ticketReq = httpTesting.expectOne(`${environment.apiOrigin}/media/uploads`);
    expect(ticketReq.request.method).toBe('POST');
    expect(ticketReq.request.body).toEqual({
      purpose: 'FIXER_PORTFOLIO',
      contentType: 'image/jpeg',
      sizeBytes: testFile.size
    });
    ticketReq.flush({
      mediaId: 'm-new-999',
      method: 'PUT',
      uploadUrl: 'http://minio.storage.local/bucket/m-new-999.jpg',
      headers: { 'Content-Type': 'image/jpeg' },
      expiresAt: '2026-09-20T12:00:00Z'
    });

    // 2. PUT binario directo al almacenamiento (MinIO/S3)
    const binaryReq = httpTesting.expectOne('http://minio.storage.local/bucket/m-new-999.jpg');
    expect(binaryReq.request.method).toBe('PUT');
    // El PUT binario no lleva Authorization
    expect(binaryReq.request.headers.has('Authorization')).toBe(false);
    // Conserva el Content-Type y el body es binario (File/Blob), nunca JSON
    expect(binaryReq.request.headers.get('Content-Type')).toBe('image/jpeg');
    expect(binaryReq.request.body).toBe(testFile);
    binaryReq.flush('OK', { status: 200, statusText: 'OK' });

    // 3. Confirmación de carga al backend
    const confirmReq = httpTesting.expectOne(`${environment.apiOrigin}/media/uploads/m-new-999/confirm`);
    expect(confirmReq.request.method).toBe('POST');
    confirmReq.flush({ mediaId: 'm-new-999', status: 'CONFIRMED' });

    // 4. Creación de la pieza con mediaId (nunca storageKey)
    const pieceReq = httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio/pieces`);
    expect(pieceReq.request.method).toBe('POST');
    expect(pieceReq.request.body).toEqual({
      mediaId: 'm-new-999',
      title: 'Nuevo proyecto',
      description: 'Descripción del proyecto'
    });
    expect(JSON.stringify(pieceReq.request.body)).not.toContain('storageKey');
    expect(JSON.stringify(pieceReq.request.body)).not.toContain('kind');
    pieceReq.flush({ ...mockPiece1, id: 'p-new', mediaId: 'm-new-999', title: 'Nuevo proyecto' });

    // 5. Recarga automática del portafolio
    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio`).flush({
      ...initialPortfolio,
      pieces: [...initialPortfolio.pieces, { ...mockPiece1, id: 'p-new', mediaId: 'm-new-999' }]
    });

    expect(component.subiendo()).toBe(false);
    expect(component.titulo).toBe('');
    expect(component.archivoSeleccionado()).toBeNull();
  });

  it('1. fallo solicitando ticket y reintento con ticket nuevo', () => {
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio`).flush(initialPortfolio);

    const testFile = new File(['content'], 'foto.jpg', { type: 'image/jpeg' });
    component.titulo = 'Proyecto';
    component.archivoSeleccionado.set(testFile);

    component.iniciarSubida();

    // 1. Falla al solicitar ticket
    const ticketReq = httpTesting.expectOne(`${environment.apiOrigin}/media/uploads`);
    ticketReq.flush(null, { status: 500, statusText: 'Server Error' });

    expect(component.archivoFallido()?.failedStage).toBe('TICKET');
    expect(component.archivoFallido()?.file).toBe(testFile);

    // 2. Reintento: solicita un nuevo ticket
    component.reintentarSubida();
    const retryTicketReq = httpTesting.expectOne(`${environment.apiOrigin}/media/uploads`);
    retryTicketReq.flush({
      mediaId: 'm-retry-ticket',
      method: 'PUT',
      uploadUrl: 'http://storage.local/upload-new',
      headers: { 'Content-Type': 'image/jpeg' },
      expiresAt: '2099-01-01T00:00:00Z'
    });

    httpTesting.expectOne('http://storage.local/upload-new').flush('OK');
    httpTesting.expectOne(`${environment.apiOrigin}/media/uploads/m-retry-ticket/confirm`).flush({
      mediaId: 'm-retry-ticket',
      status: 'CONFIRMED'
    });
    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio/pieces`).flush({
      ...mockPiece1,
      id: 'p-new',
      mediaId: 'm-retry-ticket'
    });
    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio`).flush(initialPortfolio);

    expect(component.archivoFallido()).toBeNull();
  });

  it('2. fallo de PUT sin ejecutar confirmación y conservación de estado', () => {
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio`).flush(initialPortfolio);

    const testFile = new File(['content'], 'fallo.png', { type: 'image/png' });
    component.titulo = 'Trabajo que fallará';
    component.descripcion = 'Detalle';
    component.archivoSeleccionado.set(testFile);

    component.iniciarSubida();

    httpTesting.expectOne(`${environment.apiOrigin}/media/uploads`).flush({
      mediaId: 'm-fail',
      method: 'PUT',
      uploadUrl: 'http://storage.local/upload-fail',
      headers: {},
      expiresAt: '2099-01-01T00:00:00Z'
    });

    // Falla la carga binaria contra el almacenamiento externo
    const binaryReq = httpTesting.expectOne('http://storage.local/upload-fail');
    binaryReq.flush(null, { status: 500, statusText: 'Storage Error' });

    // NO se debe llamar a confirmación
    httpTesting.expectNone(`${environment.apiOrigin}/media/uploads/m-fail/confirm`);

    // Formulario y estado recuperable se conservan en memoria
    expect(component.errorRecuperable()).toBe(true);
    expect(component.archivoFallido()?.failedStage).toBe('UPLOAD');
    expect(component.archivoFallido()?.ticket?.mediaId).toBe('m-fail');
  });

  it('3. fallo de PUT con ticket vigente y reintento sin pedir otro ticket', () => {
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio`).flush(initialPortfolio);

    const testFile = new File(['content'], 'foto.webp', { type: 'image/webp' });
    const ticketVigente = {
      mediaId: 'm-vigente',
      method: 'PUT',
      uploadUrl: 'http://storage.local/upload-vigente',
      headers: { 'Content-Type': 'image/webp' },
      expiresAt: '2099-12-31T23:59:59Z' // Vigente
    };

    component.archivoFallido.set({
      file: testFile,
      title: 'Pintura de fachada',
      ticket: ticketVigente,
      mediaId: 'm-vigente',
      failedStage: 'UPLOAD'
    });

    component.reintentarSubida();

    // NO debe pedir otro ticket
    httpTesting.expectNone(`${environment.apiOrigin}/media/uploads`);

    // Repite PUT con el ticket actual
    httpTesting.expectOne('http://storage.local/upload-vigente').flush('OK');

    // Continúa con confirm y addPiece
    httpTesting.expectOne(`${environment.apiOrigin}/media/uploads/m-vigente/confirm`).flush({
      mediaId: 'm-vigente',
      status: 'CONFIRMED'
    });
    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio/pieces`).flush({
      ...mockPiece1,
      id: 'p-vigente',
      mediaId: 'm-vigente'
    });
    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio`).flush(initialPortfolio);

    expect(component.archivoFallido()).toBeNull();
  });

  it('4. fallo de PUT con ticket vencido y solicitud de ticket nuevo', () => {
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio`).flush(initialPortfolio);

    const testFile = new File(['content'], 'foto.jpg', { type: 'image/jpeg' });
    const ticketVencido = {
      mediaId: 'm-old',
      method: 'PUT',
      uploadUrl: 'http://storage.local/upload-old',
      headers: {},
      expiresAt: '2020-01-01T00:00:00Z' // Vencido
    };

    component.archivoFallido.set({
      file: testFile,
      title: 'Piso laminado',
      ticket: ticketVencido,
      mediaId: 'm-old',
      failedStage: 'UPLOAD'
    });

    component.reintentarSubida();

    // Al estar vencido, debe solicitar un nuevo ticket
    const newTicketReq = httpTesting.expectOne(`${environment.apiOrigin}/media/uploads`);
    newTicketReq.flush({
      mediaId: 'm-fresh',
      method: 'PUT',
      uploadUrl: 'http://storage.local/upload-fresh',
      headers: { 'Content-Type': 'image/jpeg' },
      expiresAt: '2099-01-01T00:00:00Z'
    });

    httpTesting.expectOne('http://storage.local/upload-fresh').flush('OK');
    httpTesting.expectOne(`${environment.apiOrigin}/media/uploads/m-fresh/confirm`).flush({
      mediaId: 'm-fresh',
      status: 'CONFIRMED'
    });
    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio/pieces`).flush({
      ...mockPiece1,
      id: 'p-fresh',
      mediaId: 'm-fresh'
    });
    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio`).flush(initialPortfolio);

    expect(component.archivoFallido()).toBeNull();
  });

  it('5. fallo de confirmación y reintento con el mismo mediaId sin repetir ticket ni PUT', () => {
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio`).flush(initialPortfolio);

    const testFile = new File(['content'], 'foto.png', { type: 'image/png' });
    component.archivoFallido.set({
      file: testFile,
      title: 'Reparación techo',
      mediaId: 'm-confirm-test',
      failedStage: 'CONFIRM'
    });

    component.reintentarSubida();

    // No debe pedir ticket ni repetir PUT
    httpTesting.expectNone(`${environment.apiOrigin}/media/uploads`);

    // Repite confirmUpload directamente con el mismo mediaId
    const confirmReq = httpTesting.expectOne(`${environment.apiOrigin}/media/uploads/m-confirm-test/confirm`);
    confirmReq.flush({ mediaId: 'm-confirm-test', status: 'CONFIRMED' });

    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio/pieces`).flush({
      ...mockPiece1,
      id: 'p-ok',
      mediaId: 'm-confirm-test'
    });
    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio`).flush(initialPortfolio);

    expect(component.archivoFallido()).toBeNull();
  });

  it('6. fallo creando la pieza y reintento con el mismo mediaId sin repetir etapas anteriores', () => {
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio`).flush(initialPortfolio);

    const testFile = new File(['content'], 'foto.webp', { type: 'image/webp' });
    component.archivoFallido.set({
      file: testFile,
      title: 'Mueble a medida',
      description: 'Madera de roble',
      mediaId: 'm-create-test',
      failedStage: 'CREATE'
    });

    component.reintentarSubida();

    // No debe repetir ticket, PUT ni confirm
    httpTesting.expectNone(`${environment.apiOrigin}/media/uploads`);
    httpTesting.expectNone(`${environment.apiOrigin}/media/uploads/m-create-test/confirm`);

    // Repite addPiece directamente con el mismo mediaId
    const pieceReq = httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio/pieces`);
    expect(pieceReq.request.body).toEqual({
      mediaId: 'm-create-test',
      title: 'Mueble a medida',
      description: 'Madera de roble'
    });
    pieceReq.flush({ ...mockPiece1, id: 'p-created', mediaId: 'm-create-test' });

    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio`).flush(initialPortfolio);

    expect(component.archivoFallido()).toBeNull();
  });

  it('7. respuesta perdida al crear la pieza: 409 MEDIA_ALREADY_ATTACHED, recarga y recuperación por mediaId', () => {
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio`).flush(initialPortfolio);

    const testFile = new File(['content'], 'foto.jpg', { type: 'image/jpeg' });
    component.archivoFallido.set({
      file: testFile,
      title: 'Obra ya registrada',
      mediaId: 'm-already-attached',
      failedStage: 'CREATE'
    });

    component.reintentarSubida();

    // Falla con 409
    const pieceReq = httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio/pieces`);
    pieceReq.flush(
      { code: 'MEDIA_ALREADY_ATTACHED', message: 'Media is already attached to portfolio' },
      { status: 409, statusText: 'Conflict' }
    );

    // Debe recargar automáticamente el portafolio para verificar si la pieza ya existe
    const reloadReq = httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio`);
    reloadReq.flush({
      ...initialPortfolio,
      pieces: [
        ...initialPortfolio.pieces,
        { ...mockPiece1, id: 'p-recovered', mediaId: 'm-already-attached' }
      ]
    });

    // Al existir la pieza con ese mediaId, el flujo se considera completado exitosamente
    expect(component.archivoFallido()).toBeNull();
    expect(component.subiendo()).toBe(false);
  });

  it('8. limpieza del estado después de completar el flujo exitosamente', () => {
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio`).flush(initialPortfolio);

    const testFile = new File(['data'], 'clean.jpg', { type: 'image/jpeg' });
    component.titulo = 'Pared estucada';
    component.descripcion = 'Acabado liso';
    component.archivoSeleccionado.set(testFile);

    component.iniciarSubida();

    httpTesting.expectOne(`${environment.apiOrigin}/media/uploads`).flush({
      mediaId: 'm-clean',
      method: 'PUT',
      uploadUrl: 'http://storage.local/upload-clean',
      headers: { 'Content-Type': 'image/jpeg' },
      expiresAt: '2099-01-01T00:00:00Z'
    });
    httpTesting.expectOne('http://storage.local/upload-clean').flush('OK');
    httpTesting.expectOne(`${environment.apiOrigin}/media/uploads/m-clean/confirm`).flush({
      mediaId: 'm-clean',
      status: 'CONFIRMED'
    });
    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio/pieces`).flush({
      ...mockPiece1,
      id: 'p-clean',
      mediaId: 'm-clean'
    });
    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio`).flush(initialPortfolio);

    // Estado completamente limpio
    expect(component.archivoFallido()).toBeNull();
    expect(component.titulo).toBe('');
    expect(component.descripcion).toBe('');
    expect(component.archivoSeleccionado()).toBeNull();
    expect(component.subiendo()).toBe(false);
    expect(component.pasoCarga()).toBe('IDLE');
  });

  it('no debe permitir publicar el portafolio con menos de 3 fotografías visibles', () => {
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio`).flush({
      ...initialPortfolio,
      pieces: [mockPiece1, mockPiece2] // Solo 2 visibles
    });

    expect(component.puedePublicarPortafolio()).toBe(false);

    component.publicarPortafolio();
    httpTesting.expectNone(`${environment.apiOrigin}/media/me/portfolio/publish`);
    expect(component.error()).toContain('al menos 3 fotos visibles');
  });

  it('debe publicar el portafolio cuando cuenta con 3 o más fotos visibles', () => {
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio`).flush({
      ...initialPortfolio,
      pieces: [mockPiece1, mockPiece2, mockPiece3] // 3 visibles
    });

    expect(component.puedePublicarPortafolio()).toBe(true);

    component.publicarPortafolio();

    const pubReq = httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio/publish`);
    expect(pubReq.request.method).toBe('POST');
    pubReq.flush({ fixerUserId: 'fixer-uuid-1', status: 'PUBLISHED' });

    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio`).flush({
      ...initialPortfolio,
      status: 'PUBLISHED',
      pieces: [mockPiece1, mockPiece2, mockPiece3]
    });

    expect(component.portfolio()?.status).toBe('PUBLISHED');
  });

  it('ocultar o eliminar una foto debe invocar las rutas reales y recargar el portafolio', () => {
    component.ngOnInit();
    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio`).flush({
      ...initialPortfolio,
      status: 'PUBLISHED',
      pieces: [mockPiece1, mockPiece2, mockPiece3]
    });

    // Ocultar pieza 1
    component.alternarVisibilidad(mockPiece1);
    const hideReq = httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio/pieces/${mockPiece1.id}/hide`);
    expect(hideReq.request.method).toBe('POST');
    hideReq.flush({ ...mockPiece1, visibility: 'HIDDEN' });

    httpTesting.expectOne(`${environment.apiOrigin}/media/me/portfolio`).flush({
      ...initialPortfolio,
      status: 'DRAFT', // Al quedar solo 2 visibles, el backend devuelve DRAFT
      pieces: [{ ...mockPiece1, visibility: 'HIDDEN' }, mockPiece2, mockPiece3]
    });

    expect(component.portfolio()?.status).toBe('DRAFT');
  });

  it('debe diferenciar errores 401 y 403', () => {
    component.ngOnInit();

    httpTesting
      .expectOne(`${environment.apiOrigin}/media/me/portfolio`)
      .flush(null, { status: 403, statusText: 'Forbidden' });

    expect(component.error()).toContain('debes ser un técnico verificado');

    component.cargarPortafolio();
    httpTesting
      .expectOne(`${environment.apiOrigin}/media/me/portfolio`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(component.error()).toContain('Sesión expirada o no autenticada');
  });
});
