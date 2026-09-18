import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { Role } from './auth.types';
import { CurrentUserStore } from './current-user.store';

function evaluateRolePermission(
  userStore: CurrentUserStore,
  router: Router,
  allowedRoles?: Role[]
): boolean {
  // Cuenta inactiva o suspendida
  if (userStore.status() === 'SUSPENDED' || userStore.status() === 'DISABLED') {
    router.navigate(['/auth/account-restricted']);
    return false;
  }

  // Si no tiene roles o no ha seleccionado activeRole, enviar a select-role
  if (userStore.roles().length === 0 || userStore.activeRole() === null) {
    router.navigate(['/auth/select-role']);
    return false;
  }

  // Verificación del rol activo contra los roles permitidos
  if (allowedRoles && allowedRoles.length > 0) {
    const active = userStore.activeRole();
    const hasPermission = active ? allowedRoles.includes(active) : false;
    if (!hasPermission) {
      router.navigate(['/auth/access-denied']);
      return false;
    }
  }

  return true;
}

// Guard de navegación que evalúa roles desde route.data['roles'] o por parámetro
export const roleGuard: CanActivateFn & ((allowedRoles?: Role[]) => CanActivateFn) = Object.assign(
  (route: ActivatedRouteSnapshot) => {
    const userStore = inject(CurrentUserStore);
    const router = inject(Router);
    const allowedRoles = route.data?.['roles'] as Role[] | undefined;
    return evaluateRolePermission(userStore, router, allowedRoles);
  },
  (allowedRoles?: Role[]): CanActivateFn => {
    return (route: ActivatedRouteSnapshot) => {
      const userStore = inject(CurrentUserStore);
      const router = inject(Router);
      const roles = allowedRoles ?? (route.data?.['roles'] as Role[] | undefined);
      return evaluateRolePermission(userStore, router, roles);
    };
  }
);
