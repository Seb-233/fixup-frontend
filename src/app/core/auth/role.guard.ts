import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CurrentUserStore } from './current-user.store';

/**
 * Functional guard factory that verifies if the current user possesses required roles.
 * Note: Real authorization must always be validated by the backend.
 */
export function roleGuard(allowedRoles: string[]): CanActivateFn {
  return () => {
    const userStore = inject(CurrentUserStore);
    const router = inject(Router);

    const hasPermission = userStore.hasAnyRole(allowedRoles);
    if (!hasPermission) {
      router.navigate(['/']);
      return false;
    }

    return true;
  };
}
