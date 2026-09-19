import { EnvironmentProviders } from '@angular/core';
import { provideAuth0 } from '@auth0/auth0-angular';
import { environment } from '../../../environments/environment';
import { API_ROUTES, apiUrl } from '../../api/api.routes';

const SCOPE = 'openid profile email access:fixup';

// Configura Auth0 autorizando exclusivamente los endpoints del backend de FixUp.
// El Bearer Token nunca se delega a URLs de terceros.
export function provideFixUpAuth(): EnvironmentProviders {
  const audience = environment.auth0.audience;
  const redirectUri =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : 'http://localhost:4200/auth/callback';

  const tokenOptions = {
    authorizationParams: {
      audience,
      scope: SCOPE
    }
  };

  // Las rutas de autenticación son exactas; las de negocio llevan identificadores en la
  // ruta, así que se autorizan por prefijo contra el origen del backend y nada más.
  const prefixOf = (base: string) => {
    const prefix = apiUrl(base);
    return (uri: string) => uri === prefix || uri.startsWith(`${prefix}/`) || uri.startsWith(`${prefix}?`);
  };

  return provideAuth0({
    domain: environment.auth0.domain,
    clientId: environment.auth0.clientId,
    authorizationParams: {
      redirect_uri: redirectUri,
      audience,
      scope: SCOPE
    },
    httpInterceptor: {
      allowedList: [
        { uri: apiUrl(API_ROUTES.auth.bootstrap), httpMethod: 'POST', tokenOptions },
        { uri: apiUrl(API_ROUTES.auth.me), httpMethod: 'GET', tokenOptions },
        { uri: apiUrl(API_ROUTES.auth.selectRole), httpMethod: 'POST', tokenOptions },
        // FR-UC-18
        { uriMatcher: prefixOf(API_ROUTES.requests.base), tokenOptions },
        { uriMatcher: prefixOf(API_ROUTES.quotations.base), tokenOptions }
      ]
    }
  });
}
