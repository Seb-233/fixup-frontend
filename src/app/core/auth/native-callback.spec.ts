import { isAuthCallbackUrl, nativeCallbackUrl, nativeLogoutUrl } from './native-callback';

describe('Deep link de Auth0 en Android (FR-UC-21)', () => {
  const appId = 'com.fixup.app';
  const domain = 'dev-uzssz142azr2k5hv.us.auth0.com';

  it('debe construir la dirección de retorno con el formato que Auth0 define para Capacitor', () => {
    expect(nativeCallbackUrl(appId, domain)).toBe(
      'com.fixup.app://dev-uzssz142azr2k5hv.us.auth0.com/capacitor/com.fixup.app/callback'
    );
  });

  it('debe usar la misma dirección al cerrar sesión, porque Auth0 exige que esté registrada', () => {
    expect(nativeLogoutUrl(appId, domain)).toBe(nativeCallbackUrl(appId, domain));
  });

  it('debe reconocer el deep link de retorno, con o sin parámetros de autorización', () => {
    expect(isAuthCallbackUrl(nativeCallbackUrl(appId, domain), appId)).toBe(true);
    expect(
      isAuthCallbackUrl(`${nativeCallbackUrl(appId, domain)}?code=abc&state=xyz`, appId)
    ).toBe(true);
  });

  it('no debe tratar como callback ningún otro enlace que abra la aplicación', () => {
    // Un enlace del propio esquema que no viene de Auth0
    expect(isAuthCallbackUrl('com.fixup.app://requests/123', appId)).toBe(false);
    // Un enlace web cualquiera
    expect(isAuthCallbackUrl('https://fixup.example.com/capacitor/callback', appId)).toBe(false);
    // El esquema de otra aplicación que imita la ruta
    expect(
      isAuthCallbackUrl('com.otra.app://tenant.auth0.com/capacitor/com.otra.app/callback', appId)
    ).toBe(false);
  });
});
