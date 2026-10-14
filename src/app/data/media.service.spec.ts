import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { MediaService, rejectFile } from './media.service';

describe('MediaService', () => {
  let service: MediaService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(MediaService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('pide ticket, sube el binario directo al almacenamiento y confirma', () => {
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'fuga.jpg', { type: 'image/jpeg' });
    let mediaId: string | undefined;
    service.upload(file, 'REPAIR_REQUEST').subscribe((id) => (mediaId = id));

    const ticket = backend.expectOne(`${environment.apiOrigin}/media/uploads`);
    expect(ticket.request.body).toEqual({ purpose: 'REPAIR_REQUEST', contentType: 'image/jpeg', sizeBytes: 3 });
    ticket.flush({ mediaId: 'm-1', method: 'PUT', uploadUrl: 'http://storage.test/bucket/m-1?sig=x', headers: { 'Content-Type': 'image/jpeg' }, expiresAt: '' });

    const put = backend.expectOne('http://storage.test/bucket/m-1?sig=x');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toBe(file);
    put.flush('');

    backend.expectOne(`${environment.apiOrigin}/media/uploads/m-1/confirm`).flush({ mediaId: 'm-1', status: 'READY' });
    expect(mediaId).toBe('m-1');
  });

  it('rechaza en el navegador lo que el backend no acepta', () => {
    expect(rejectFile(new File(['x'], 'cedula.pdf', { type: 'application/pdf' }))).toContain('JPG, PNG o WebP');
    const big = new File([new Uint8Array(11 * 1024 * 1024)], 'grande.png', { type: 'image/png' });
    expect(rejectFile(big)).toContain('10 MB');
    expect(rejectFile(new File(['x'], 'ok.webp', { type: 'image/webp' }))).toBeNull();
  });
});
