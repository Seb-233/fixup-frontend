import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { tap } from 'rxjs/operators';
import { AuthService } from './auth.service';

/**
 * Route guard that requires the user to be authenticated.
 * Uses the local AuthService adapter and redirects unauthenticated users to login.
 * 
 * Notice: Frontend route guards serve only for navigation control and user experience.
 * Real authorization is strictly enforced by the backend on every request.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);

  return auth.isAuthenticated$.pipe(
    tap((loggedIn) => {
      if (!loggedIn) {
        auth.loginWithRedirect();
      }
    })
  );
};
