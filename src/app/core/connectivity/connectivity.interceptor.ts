import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { retry, tap, throwError, timer } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConnectivityService, isConnectionError } from './connectivity.service';

const READS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Va primero en la cadena, así también ve las fallas del SDK de Auth0 al pedir el token.
// Las lecturas que no llegan al backend se reintentan dos veces (1 s y 2 s) antes de rendirse;
// las escrituras no, para no duplicar un pago o un mensaje: esas las reintenta la persona.
export const connectivityInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiOrigin)) return next(req);
  const connectivity = inject(ConnectivityService);
  const read = READS.has(req.method);

  return next(req).pipe(
    retry({
      count: read ? 2 : 0,
      delay: (error, attempt) => (isConnectionError(error) ? timer(1000 * attempt) : throwError(() => error))
    }),
    tap({
      next: (event) => {
        if (event instanceof HttpResponse) connectivity.reportSuccess();
      },
      error: (error) => {
        if (isConnectionError(error)) connectivity.reportFailure();
        // Cualquier otra respuesta (400, 401, 409…) prueba que el backend sí contestó.
        else if (error instanceof HttpErrorResponse) connectivity.reportSuccess();
      }
    })
  );
};
