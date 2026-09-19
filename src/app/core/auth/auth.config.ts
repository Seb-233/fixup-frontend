import { EnvironmentProviders } from '@angular/core';
import { provideAuth0 } from '@auth0/auth0-angular';
import { environment } from '../../../environments/environment';
import { API_ROUTES, apiUrl } from '../../api/api.routes';
import { isNativePlatform } from '../config/native-platform';
import { nativeCallbackUrl } from './native-callback';

const SCOPE = 'openid profile email access:fixup';

// Devuelve la dirección a la que Auth0 entrega el control después de autenticar.
// En Android la vuelta ocurre por deep link; en web y PWA, por la ruta /auth/callback.
// La plataforma entra por parámetro para que la regla se pueda probar sin simular Capacitor.
export function resolveRedirectUri(native: boolean = isNativePlatform()): string {
  if (native) {
    return nativeCallbackUrl(environment.native.appId, environment.auth0.domain);
  }
  return typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback`
    : 'http://localhost:4200/auth/callback';
}

// Configura Auth0 autorizando exclusivamente los tres endpoints exactos del backend
export function provideFixUpAuth(): EnvironmentProviders {
  const audience = environment.auth0.audience;
  const native = isNativePlatform();

  const tokenOptions = {
    authorizationParams: {
      audience,
      scope: SCOPE
    }
  };

  return provideAuth0({
    domain: environment.auth0.domain,
    clientId: environment.auth0.clientId,
    // FR-UC-21: dentro del contenedor nativo no hay cookies de terceros, así que la renovación
    // silenciosa por iframe no funciona. Android renueva con refresh token y no cae al iframe.
    useRefreshTokens: native,
    useRefreshTokensFallback: false,
    authorizationParams: {
      redirect_uri: resolveRedirectUri(native),
      audience,
      scope: SCOPE
    },
    httpInterceptor: {
      allowedList: [
        { uri: apiUrl(API_ROUTES.auth.bootstrap), httpMethod: 'POST', tokenOptions },
        { uri: apiUrl(API_ROUTES.auth.me), httpMethod: 'GET', tokenOptions },
        { uri: apiUrl(API_ROUTES.auth.selectRole), httpMethod: 'POST', tokenOptions }
      ]
    }
  });
}
