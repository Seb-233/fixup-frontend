import { API_ROUTES, apiUrl, isFixUpApiUrl } from './api.routes';
import { environment } from '../../environments/environment';

describe('api.routes', () => {
  it('debe construir la URL absoluta combinando el origen configurado y la ruta', () => {
    expect(apiUrl(API_ROUTES.auth.me)).toBe(`${environment.apiOrigin}/auth/me`);
  });

  it('debe reconocer como protegidas las rutas de los casos de uso (incluyendo /requests, /quotations y /properties)', () => {
    const protegidas = [
      '/auth/me',
      '/auth/bootstrap',
      '/fixers/me/verification',
      '/fixers/me/verification/documents',
      '/media/me/portfolio',
      '/analytics/zones/CHAPINERO/market-indicators',
      '/requests/me',
      '/requests/open',
      '/requests',
      '/quotations',
      '/quotations/me',
      '/quotations/req-123/accept',
      '/quotations/req-123/reject',
      '/jobs/me',
      '/jobs/job-123/complete',
      '/payments/me/earnings',
      '/payments/me/payouts',
      '/properties',
      '/properties/me',
      '/properties/550e8400-e29b-41d4-a716-446655440000'
    ];

    for (const ruta of protegidas) {
      expect(isFixUpApiUrl(`${environment.apiOrigin}${ruta}`)).toBe(true);
    }
  });

  it('no debe adjuntar el token a un origen ajeno aunque la ruta coincida', () => {
    expect(isFixUpApiUrl('https://atacante.example.com/auth/me')).toBe(false);
    expect(isFixUpApiUrl('https://atacante.example.com/media/me/portfolio')).toBe(false);
  });

  it('no debe tratar como protegida una ruta del backend fuera de los prefijos declarados', () => {
    expect(isFixUpApiUrl(`${environment.apiOrigin}/actuator/health`)).toBe(false);
    expect(isFixUpApiUrl(`${environment.apiOrigin}/v3/api-docs`)).toBe(false);
  });

  it('no debe adjuntar el token a una ruta que solo se parece a las del dinero', () => {
    expect(isFixUpApiUrl(`${environment.apiOrigin}/jobs-export`)).toBe(false);
    expect(isFixUpApiUrl(`${environment.apiOrigin}/payments-report`)).toBe(false);
  });

  it('no debe confundir un origen que solo comienza igual', () => {
    expect(isFixUpApiUrl(`${environment.apiOrigin}.evil.example.com/auth/me`)).toBe(false);
  });
});
