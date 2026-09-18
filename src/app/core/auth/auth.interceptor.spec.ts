import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authHttpInterceptorFn, Auth0ClientService, AuthService as Auth0Service } from '@auth0/auth0-angular';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { apiUrl, API_ROUTES } from '../../api/api.routes';
import { environment } from '../../../environments/environment';
import { provideFixUpAuth } from './auth.config';

describe('authHttpInterceptorFn (Mecanismo Único de Token)', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  const mockAuth0Service = {
    isLoading$: of(false),
    getAccessTokenSilently: () => of('valid-auth0-test-token')
  };

  const mockAuth0Client = {
    getTokenSilently: vi.fn().mockReturnValue(Promise.resolve('valid-auth0-test-token'))
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideFixUpAuth(),
        provideHttpClient(withInterceptors([authHttpInterceptorFn])),
        provideHttpClientTesting(),
        { provide: Auth0Service, useValue: mockAuth0Service },
        { provide: Auth0ClientService, useValue: mockAuth0Client }
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('13. debe adjuntar un único encabezado Authorization para POST /auth/bootstrap', async () => {
    const targetUrl = apiUrl(API_ROUTES.auth.bootstrap);
    http.post(targetUrl, {}).subscribe();
    await Promise.resolve();

    const req = httpMock.expectOne(targetUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.has('Authorization')).toBe(true);

    const authHeaders = req.request.headers.getAll('Authorization');
    expect(authHeaders?.length).toBe(1);
    expect(authHeaders?.[0]).toBe('Bearer valid-auth0-test-token');
    req.flush({ id: '1', displayName: 'User', status: 'ACTIVE', roles: [] });
  });

  it('13. debe adjuntar un único encabezado Authorization para GET /auth/me', async () => {
    const targetUrl = apiUrl(API_ROUTES.auth.me);
    http.get(targetUrl).subscribe();
    await Promise.resolve();

    const req = httpMock.expectOne(targetUrl);
    expect(req.request.method).toBe('GET');
    expect(req.request.headers.has('Authorization')).toBe(true);

    const authHeaders = req.request.headers.getAll('Authorization');
    expect(authHeaders?.length).toBe(1);
    expect(authHeaders?.[0]).toBe('Bearer valid-auth0-test-token');
    req.flush({ id: '1', displayName: 'User', status: 'ACTIVE', roles: ['OWNER'] });
  });

  it('13. debe adjuntar un único encabezado Authorization para POST /auth/select-role', async () => {
    const targetUrl = apiUrl(API_ROUTES.auth.selectRole);
    http.post(targetUrl, { role: 'OWNER' }).subscribe();
    await Promise.resolve();

    const req = httpMock.expectOne(targetUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.has('Authorization')).toBe(true);

    const authHeaders = req.request.headers.getAll('Authorization');
    expect(authHeaders?.length).toBe(1);
    expect(authHeaders?.[0]).toBe('Bearer valid-auth0-test-token');
    req.flush({ roles: ['OWNER'] });
  });

  it('14. ninguna petición externa ni servicio de terceros debe recibir el Bearer token', async () => {
    const externalUrl = 'https://api.mapbox.com/geocoding/v5/mapbox.places/bogota.json';
    http.get(externalUrl).subscribe();
    await Promise.resolve();

    const req = httpMock.expectOne(externalUrl);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('14. no debe adjuntar tokens a rutas internas no autorizadas expresamente', async () => {
    // Mismo origen que la API pero fuera de los prefijos protegidos: el health publico
    // del backend es permitAll y no debe recibir el token.
    const internalUnprotected = `${environment.apiOrigin}/actuator/health`;
    http.get(internalUnprotected).subscribe();
    await Promise.resolve();

    const req = httpMock.expectOne(internalUnprotected);
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ status: 'UP' });
  });
});
