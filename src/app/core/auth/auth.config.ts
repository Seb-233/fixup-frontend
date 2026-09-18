import { EnvironmentProviders } from '@angular/core';
import { provideAuth0 } from '@auth0/auth0-angular';
import { environment } from '../../../environments/environment';
import { API_ROUTES, apiUrl } from '../../api/api.routes';

// Configura Auth0 autorizando exclusivamente los tres endpoints exactos del backend
export function provideFixUpAuth(): EnvironmentProviders {
  return provideAuth0({
    domain: environment.auth0.domain,
    clientId: environment.auth0.clientId,
    authorizationParams: {
      redirect_uri: typeof window !== 'undefined' ? window.location.origin : '',
      audience: environment.auth0.audience
    },
    httpInterceptor: {
      allowedList: [
        {
          uri: apiUrl(API_ROUTES.auth.bootstrap),
          httpMethod: 'POST',
          tokenOptions: {
            authorizationParams: {
              audience: environment.auth0.audience
            }
          }
        },
        {
          uri: apiUrl(API_ROUTES.auth.me),
          httpMethod: 'GET',
          tokenOptions: {
            authorizationParams: {
              audience: environment.auth0.audience
            }
          }
        },
        {
          uri: apiUrl(API_ROUTES.auth.selectRole),
          httpMethod: 'POST',
          tokenOptions: {
            authorizationParams: {
              audience: environment.auth0.audience
            }
          }
        }
      ]
    }
  });
}
