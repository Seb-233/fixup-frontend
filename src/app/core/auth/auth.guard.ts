import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { AuthService } from '@auth0/auth0-angular';
import { tap } from 'rxjs/operators';

/**
 * Route guard that requires the user to be authenticated via Auth0.
 * Redirects unauthenticated users to the Auth0 login page.
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
