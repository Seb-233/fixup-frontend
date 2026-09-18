import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthService } from './auth.service';
import { CurrentUserStore } from './current-user.store';

// Guard de navegación para proteger rutas privadas
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const userStore = inject(CurrentUserStore);
  const router = inject(Router);

  // Si el perfil ya está cargado y autenticado, permitir acceso inmediato
  if (userStore.profileLoaded() && userStore.authenticated()) {
    return true;
  }

  // Esperar la resolución de la sesión compartida
  return auth.sessionReady$.pipe(
    take(1),
    map((profile) => {
      if (profile) {
        return true;
      }
      router.navigate(['/auth/login']);
      return false;
    })
  );
};
