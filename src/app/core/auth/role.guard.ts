import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CurrentUserStore } from './current-user.store';

/**
 * Functional guard factory that verifies if the current user possesses required roles.
 * 
 * IMPORTANT ARCHITECTURAL NOTE:
 * This guard is a client-side navigation and UX helper only and is NOT considered
 * functional until the backend profile (GET /users/me) is integrated in subsequent phases.
 * True data and resource authorization is always enforced strictly on the backend.
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
