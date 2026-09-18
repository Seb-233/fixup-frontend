import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from './auth.types';
import { CurrentUserStore } from './current-user.store';

// Control de navegación y experiencia visual en cliente según roles
// AVISO: La seguridad y autorización real se evalúa siempre en el backend en cada petición
export function roleGuard(allowedRoles: Role[]): CanActivateFn {
  return () => {
    const userStore = inject(CurrentUserStore);
    const router = inject(Router);

    // Cuenta inactiva
    if (userStore.status() === 'SUSPENDED' || userStore.status() === 'DISABLED') {
      router.navigate(['/auth/account-restricted']);
      return false;
    }

    // Usuario sin roles asignados debe seleccionar su rol inicial
    if (userStore.roles().length === 0) {
      router.navigate(['/auth/select-role']);
      return false;
    }

    // Verificación de posesión de al menos uno de los roles permitidos
    const hasPermission = userStore.hasAnyRole(allowedRoles);
    if (!hasPermission) {
      router.navigate(['/auth/access-denied']);
      return false;
    }

    return true;
  };
}
