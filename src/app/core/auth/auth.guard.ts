import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, switchMap, take } from 'rxjs';
import { AuthService } from './auth.service';
import { CurrentUserStore } from './current-user.store';

// Guard de navegación para proteger rutas privadas
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const userStore = inject(CurrentUserStore);
  const router = inject(Router);

  // Si el perfil ya está cargado y autenticado, permitir acceso inmediato
  if (userStore.initialized() && userStore.authenticated()) {
    return true;
  }

  // Esperar a que Auth0 termine de cargar (isLoading$ = false) y se resuelva sessionReady$
  return auth.isLoading$.pipe(
    filter((loading) => !loading),
    take(1),
    switchMap(() => auth.sessionReady$),
    take(1),
    map((profile) => {
      if (profile && userStore.authenticated()) {
        return true;
      }

      // Sanitizar returnUrl: únicamente rutas internas válidas
      const targetUrl =
        state.url && state.url.startsWith('/') && !state.url.startsWith('//')
          ? state.url
          : '/dashboard';

      router.navigate(['/auth/login'], {
        queryParams: { returnUrl: targetUrl }
      });
      return false;
    })
  );
};
