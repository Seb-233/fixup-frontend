import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { authHttpInterceptorFn } from '@auth0/auth0-angular';
import { isFixUpApiUrl } from '../../api/api.routes';
import { DemoSession } from './demo-session';

// Con sesión de demostración activa, el token del backend local viaja en las llamadas a la API de
// Fix&Rent y Auth0 no interviene. Sin ella, todo pasa por el interceptor de Auth0 de siempre.
export const fixupAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const demo = inject(DemoSession);
  const token = demo.token;
  if (token && isFixUpApiUrl(req.url)) {
    return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
  }
  return authHttpInterceptorFn(req, next);
};
