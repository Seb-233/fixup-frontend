import { environment } from '../../../environments/environment';
import { resolveRedirectUri } from './auth.config';

describe('Dirección de retorno según la plataforma (FR-UC-21)', () => {
  it('en web y PWA debe volver a /auth/callback sobre el origen del navegador', () => {
    expect(resolveRedirectUri(false)).toBe(`${window.location.origin}/auth/callback`);
  });

  it('en Android debe volver por el deep link del paquete, no por localhost', () => {
    const uri = resolveRedirectUri(true);

    expect(uri).toBe(
      `${environment.native.appId}://${environment.auth0.domain}/capacitor/${environment.native.appId}/callback`
    );
    // Si esto vuelve a empezar por http, Auth0 no puede devolver el control dentro de la app
    expect(uri.startsWith('http')).toBe(false);
  });

  it('el identificador del paquete debe coincidir con el declarado en capacitor.config.ts', () => {
    // Si alguien cambia el appId en un solo sitio, el deep link deja de resolver en Android.
    expect(environment.native.appId).toBe('com.fixup.app');
  });
});
