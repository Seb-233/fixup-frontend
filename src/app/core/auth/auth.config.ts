import { EnvironmentProviders } from '@angular/core';
import { provideAuth0 } from '@auth0/auth0-angular';
import { environment } from '../../../environments/environment';
import { API_ROUTES, apiUrl } from '../../api/api.routes';

// Configura Auth0 autorizando exclusivamente los tres endpoints exactos del backend
export function provideFixUpAuth(): EnvironmentProviders {
  const auth0Params = environment.auth0.authorizationParams;
  const audience = auth0Params.audience;
  const redirectUri =
    auth0Params.redirect_uri || (typeof window !== 'undefined' ? window.location.origin : '');

  return provideAuth0({
    domain: environment.auth0.domain,
    clientId: environment.auth0.clientId,
    authorizationParams: {
      redirect_uri: redirectUri,
      audience
    },
    httpInterceptor: {
      allowedList: [
        {
          uri: apiUrl(API_ROUTES.auth.bootstrap),
          httpMethod: 'POST',
          tokenOptions: {
            authorizationParams: {
              audience
            }
          }
        },
        {
          uri: apiUrl(API_ROUTES.auth.me),
          httpMethod: 'GET',
          tokenOptions: {
            authorizationParams: {
              audience
            }
          }
        },
        {
          uri: apiUrl(API_ROUTES.auth.selectRole),
          httpMethod: 'POST',
          tokenOptions: {
            authorizationParams: {
              audience
            }
          }
        }
      ]
    }
  });
}
