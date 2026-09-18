import { EnvironmentProviders } from '@angular/core';
import { provideAuth0 } from '@auth0/auth0-angular';
import { environment } from '../../../environments/environment';
import { API_ROUTES, apiUrl } from '../../api/api.routes';

// Configura Auth0 autorizando exclusivamente los tres endpoints exactos del backend
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
      allowedList: [
        {
          uri: apiUrl(API_ROUTES.auth.bootstrap),
          httpMethod: 'POST',
          tokenOptions: {
            authorizationParams: {
              audience,
              scope: 'openid profile email access:fixup'
            }
          }
        },
        {
          uri: apiUrl(API_ROUTES.auth.me),
          httpMethod: 'GET',
          tokenOptions: {
            authorizationParams: {
              audience,
              scope: 'openid profile email access:fixup'
            }
          }
        },
        {
          uri: apiUrl(API_ROUTES.auth.selectRole),
          httpMethod: 'POST',
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
