import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { MediaPurpose, MediaUploadsControllerService, provideApi } from '../../../api/generated';
import { RequestMediaService } from './request-media.service';

describe('RequestMediaService (Carga Segura de Medios para Solicitudes)', () => {
  let service: RequestMediaService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        RequestMediaService,
        MediaUploadsControllerService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApi(environment.apiOrigin)
      ]
    });

    service = TestBed.inject(RequestMediaService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  describe('Validación de archivos (MIME y tamaño)', () => {
    it('debe aceptar archivos válidos de tipo JPEG, PNG y WebP menores a 10MB', () => {
      const validJpeg = new File(['data'], 'foto.jpg', { type: 'image/jpeg' });
      const validPng = new File(['data'], 'foto.png', { type: 'image/png' });
      const validWebp = new File(['data'], 'foto.webp', { type: 'image/webp' });

      expect(service.validateFile(validJpeg).valid).toBe(true);
      expect(service.validateFile(validPng).valid).toBe(true);
      expect(service.validateFile(validWebp).valid).toBe(true);
    });

    it('debe rechazar archivos con tipo MIME inválido', () => {
      const invalidPdf = new File(['data'], 'doc.pdf', { type: 'application/pdf' });
      const invalidGif = new File(['data'], 'anim.gif', { type: 'image/gif' });
      const invalidVideo = new File(['data'], 'video.mp4', { type: 'video/mp4' });

      const checkPdf = service.validateFile(invalidPdf);
      expect(checkPdf.valid).toBe(false);
      expect(checkPdf.error).toContain('Solo se admiten imágenes JPEG, PNG y WebP');

      expect(service.validateFile(invalidGif).valid).toBe(false);
      expect(service.validateFile(invalidVideo).valid).toBe(false);
    });

    it('debe rechazar archivos cuyo tamaño supere los 10MB', () => {
      // 10MB + 1 byte
      const bigBuffer = new Uint8Array(10 * 1024 * 1024 + 1);
      const oversizedFile = new File([bigBuffer], 'grande.jpg', { type: 'image/jpeg' });

      const check = service.validateFile(oversizedFile);
      expect(check.valid).toBe(false);
      expect(check.error).toContain('10 MB');
    });
  });

  describe('Flujo de carga segura de medios', () => {
    it('debe solicitar ticket con propósito REPAIR_REQUEST', () => {
      const file = new File(['content'], 'evidencia.jpg', { type: 'image/jpeg' });

      service.requestUploadTicket(file).subscribe((ticket) => {
        expect(ticket.mediaId).toBe('media-uuid-1');
        expect(ticket.uploadUrl).toBe('http://storage.local/upload/media-uuid-1');
      });

      const req = httpTesting.expectOne(`${environment.apiOrigin}/media/uploads`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        purpose: MediaPurpose.RepairRequest,
        contentType: 'image/jpeg',
        sizeBytes: file.size
      });

      req.flush({
        mediaId: 'media-uuid-1',
        method: 'PUT',
        uploadUrl: 'http://storage.local/upload/media-uuid-1',
        headers: { 'Content-Type': 'image/jpeg' },
        expiresAt: '2026-09-20T12:00:00Z'
      });
    });

    it('debe realizar PUT binario al almacenamiento externo SIN cabecera Authorization', () => {
      const file = new File(['binary-photo-content'], 'foto.jpg', { type: 'image/jpeg' });
      const ticket = {
        mediaId: 'media-uuid-1',
        method: 'PUT',
        uploadUrl: 'http://storage.local/upload/media-uuid-1',
        headers: { 'Content-Type': 'image/jpeg' },
        expiresAt: '2026-09-20T12:00:00Z'
      };

      service.uploadBinary(ticket, file).subscribe((res) => {
        expect(res.status).toBe(200);
      });

      const binaryReq = httpTesting.expectOne('http://storage.local/upload/media-uuid-1');
      expect(binaryReq.request.method).toBe('PUT');
      expect(binaryReq.request.headers.has('Authorization')).toBe(false);
      expect(binaryReq.request.headers.get('Content-Type')).toBe('image/jpeg');
      expect(binaryReq.request.body).toBe(file);

      binaryReq.flush('OK', { status: 200, statusText: 'OK' });
    });

    it('debe confirmar la carga en el backend mediante mediaId', () => {
      service.confirmUpload('media-uuid-1').subscribe((res) => {
        expect(res.mediaId).toBe('media-uuid-1');
        expect(res.status).toBe('READY');
      });

      const req = httpTesting.expectOne(`${environment.apiOrigin}/media/uploads/media-uuid-1/confirm`);
      expect(req.request.method).toBe('POST');
      req.flush({ mediaId: 'media-uuid-1', status: 'READY' });
    });
  });
});
