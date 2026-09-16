import { EnvironmentProviders } from '@angular/core';
import { provideAuth0 } from '@auth0/auth0-angular';
import { environment } from '../../../environments/environment';

export interface FixUpAuthConfig {
  domain: string;
  clientId: string;
  audience: string;
  apiBaseUrl: string;
}

/**
 * Provides Auth0 configuration with explicit allowed list of API endpoints.
 * Never includes client secrets or private tokens.
 */
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
          uri: `${environment.apiBaseUrl}/*`,
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
