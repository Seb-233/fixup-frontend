import { EnvironmentProviders } from '@angular/core';
import { provideAuth0 } from '@auth0/auth0-angular';
import { environment } from '../../../environments/environment';
import { isFixUpApiUrl } from '../../api/api.routes';

// Configura Auth0 y autoriza el envío del token únicamente a los endpoints del backend de FixUp
export function provideFixUpAuth(): EnvironmentProviders {
  const audience = environment.auth0.audience;
  const redirectUri =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : 'http://localhost:4200/auth/callback';

  return provideAuth0({
    domain: environment.auth0.domain,
    clientId: environment.auth0.clientId,
    authorizationParams: {
      redirect_uri: redirectUri,
      audience,
      scope: 'openid profile email access:fixup'
    },
    httpInterceptor: {
      // Un solo criterio para todas las rutas protegidas del backend: cada caso de uso nuevo
      // deja de requerir una entrada propia aquí, y el token nunca se adjunta a un tercero
      // porque isFixUpApiUrl compara contra environment.apiOrigin.
      allowedList: [
        {
          uriMatcher: isFixUpApiUrl,
          tokenOptions: {
            authorizationParams: {
              audience,
              scope: 'openid profile email access:fixup'
            }
          }
        }
      ]
    }
  });
}
