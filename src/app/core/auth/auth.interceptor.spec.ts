import { HttpRequest, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { apiUrl, API_ROUTES } from '../../api/api.routes';
import { authInterceptor } from './auth.interceptor';

// Mock del interceptor nativo del SDK de Auth0
vi.mock('@auth0/auth0-angular', () => ({
  authHttpInterceptorFn: vi.fn((req: HttpRequest<unknown>, next: (r: HttpRequest<unknown>) => unknown) => next(req))
}));

import { authHttpInterceptorFn } from '@auth0/auth0-angular';

describe('authInterceptor', () => {
  const nextFn = vi.fn(() => of(new HttpResponse<unknown>({ status: 200 })));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('debe delegar a authHttpInterceptorFn para POST /auth/bootstrap', () => {
    const req = new HttpRequest('POST', apiUrl(API_ROUTES.auth.bootstrap), {});
    authInterceptor(req, nextFn);
    expect(authHttpInterceptorFn).toHaveBeenCalledWith(req, nextFn);
  });

  it('debe delegar a authHttpInterceptorFn para GET /auth/me', () => {
    const req = new HttpRequest('GET', apiUrl(API_ROUTES.auth.me));
    authInterceptor(req, nextFn);
    expect(authHttpInterceptorFn).toHaveBeenCalledWith(req, nextFn);
  });

  it('debe delegar a authHttpInterceptorFn para POST /auth/select-role', () => {
    const req = new HttpRequest('POST', apiUrl(API_ROUTES.auth.selectRole), { role: 'OWNER' });
    authInterceptor(req, nextFn);
    expect(authHttpInterceptorFn).toHaveBeenCalledWith(req, nextFn);
  });

  it('no debe adjuntar tokens a servicios externos de terceros', () => {
    const req = new HttpRequest('GET', 'https://api.external.com/tiles/osm');
    authInterceptor(req, nextFn);
    expect(authHttpInterceptorFn).not.toHaveBeenCalled();
    expect(nextFn).toHaveBeenCalledWith(req);
  });

  it('no debe adjuntar tokens si el método HTTP no coincide con la ruta autorizada', () => {
    const req = new HttpRequest('GET', apiUrl(API_ROUTES.auth.bootstrap));
    authInterceptor(req, nextFn);
    expect(authHttpInterceptorFn).not.toHaveBeenCalled();
    expect(nextFn).toHaveBeenCalledWith(req);
  });
});
