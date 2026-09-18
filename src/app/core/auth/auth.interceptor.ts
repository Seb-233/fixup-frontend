import { HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { authHttpInterceptorFn } from '@auth0/auth0-angular';
import { API_ROUTES, apiUrl } from '../../api/api.routes';

// Lista de rutas exactas autorizadas para recibir el Bearer token
const AUTHORIZED_ENDPOINTS = [
  { url: apiUrl(API_ROUTES.auth.bootstrap), method: 'POST' },
  { url: apiUrl(API_ROUTES.auth.me), method: 'GET' },
  { url: apiUrl(API_ROUTES.auth.selectRole), method: 'POST' }
];

// Interceptor dedicado exclusivamente a adjuntar el Bearer token a las rutas autorizadas
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const isAuthorized = AUTHORIZED_ENDPOINTS.some(
    (endpoint) => req.url === endpoint.url && req.method.toUpperCase() === endpoint.method
  );

  if (isAuthorized) {
    return authHttpInterceptorFn(req, next);
  }

  // Peticiones externas o no autorizadas continúan sin token
  return next(req);
};
