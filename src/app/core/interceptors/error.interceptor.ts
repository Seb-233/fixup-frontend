import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { CurrentUserStore } from '../auth/current-user.store';

// Interceptor desacoplado para categorizar y manejar errores HTTP de la API
export const errorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const router = inject(Router);
  const userStore = inject(CurrentUserStore);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Sesión inválida: limpiar estado local y redirigir al login sin reintentos automáticos
        userStore.clear();
        router.navigate(['/auth/login']);
      } else if (error.status === 403) {
        // 403 Forbidden: cuenta inactiva o falta de permiso
        const code = error.error?.code;
        if (code === 'ACCESS_DENIED' && (userStore.status() === 'SUSPENDED' || userStore.status() === 'DISABLED')) {
          router.navigate(['/auth/account-restricted']);
        } else {
          router.navigate(['/auth/access-denied']);
        }
      }

      return throwError(() => error);
    })
  );
};
