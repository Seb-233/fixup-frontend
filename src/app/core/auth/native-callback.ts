// FR-UC-21: direcciones de retorno del inicio y cierre de sesión en el contenedor nativo.
//
// Auth0 no puede devolver el control a http://localhost dentro de una aplicación Android: la
// vuelta ocurre por un deep link con el esquema del paquete. El formato es el que Auth0 define
// para Capacitor y debe coincidir exactamente con tres lugares: los Allowed Callback URLs del
// tenant, el intent-filter de AndroidManifest.xml y el appId de capacitor.config.ts.

export function nativeCallbackUrl(appId: string, auth0Domain: string): string {
  return `${appId}://${auth0Domain}/capacitor/${appId}/callback`;
}

export function nativeLogoutUrl(appId: string, auth0Domain: string): string {
  return `${appId}://${auth0Domain}/capacitor/${appId}/callback`;
}

// El deep link de vuelta trae el código de autorización; cualquier otro enlace que abra la
// aplicación (una notificación, un enlace compartido) no debe interpretarse como un callback.
export function isAuthCallbackUrl(url: string, appId: string): boolean {
  return url.startsWith(`${appId}://`) && url.includes('/capacitor/') && url.includes('/callback');
}
