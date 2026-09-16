import { HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { authHttpInterceptorFn } from '@auth0/auth0-angular';
import { environment } from '../../../environments/environment';

/**
 * Adapter interceptor ensuring the Auth0 HTTP interceptor is only executed for
 * authorized FixUp API requests and never leaks tokens to external third-party URLs.
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  // Only apply Auth0 interception to requests targeting the configured FixUp API
  if (req.url.startsWith(environment.apiBaseUrl)) {
    return authHttpInterceptorFn(req, next);
  }

  // Pass through without attaching authorization headers
  return next(req);
};
