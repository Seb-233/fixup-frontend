import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { DOCUMENT, inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { CurrentUserStore } from '../auth/current-user.store';
import { DemoSession } from '../demo/demo-session';
import { KnownPaymentsService } from '../../data/known-payments';

const RESTRICTED_CODES = new Set(['ACCOUNT_RESTRICTED', 'ACCOUNT_SUSPENDED', 'ACCOUNT_DISABLED']);

// Solo dos errores cambian de pantalla: la sesión vencida (401) y la cuenta restringida. Un 403 o un
// 409 de una acción concreta (pagar, confirmar una visita) lo explica la pantalla que lo provocó,
// sin sacar a la persona de donde estaba.
export const errorInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const router = inject(Router);
  const userStore = inject(CurrentUserStore);
  const demo = inject(DemoSession);
  const knownPayments = inject(KnownPaymentsService);
  const document = inject(DOCUMENT);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        demo.end();
        userStore.clear();
        knownPayments.clearSessionFinancialData();
        // Conserva la ruta (con su query) para volver tras ingresar: al regresar de Wompi trae el
        // ?id= de la transacción y, si la sesión venció mientras se pagaba, no se debe perder.
        const here = document.location.pathname + document.location.search;
        const keep = here.startsWith('/') && !here.startsWith('//') && here !== '/' && !here.startsWith('/auth');
        router.navigate(['/auth/login'], keep ? { queryParams: { returnUrl: here } } : undefined);
      } else if (error.status === 403) {
        const restricted =
          RESTRICTED_CODES.has(error.error?.code) ||
          userStore.status() === 'SUSPENDED' ||
          userStore.status() === 'DISABLED';
        if (restricted) router.navigate(['/auth/account-restricted']);
      }
      return throwError(() => error);
    })
  );
};
