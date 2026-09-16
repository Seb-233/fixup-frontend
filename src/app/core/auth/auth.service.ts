import { Injectable, inject } from '@angular/core';
import { AuthService as Auth0Service, User } from '@auth0/auth0-angular';
import { Observable } from 'rxjs';
import { CurrentUserStore } from './current-user.store';

/**
 * Authentication service acting as an adapter over Auth0.
 * Responsibilities:
 * - Session login and logout delegation.
 * - External identity integration (Auth0).
 * - Access token acquisition via Auth0 SDK in memory (never in localStorage).
 * 
 * Notice: Authoritative application roles are NOT read from Auth0 claims.
 * They will be fetched from the FixUp backend (GET /users/me).
 */
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly auth0 = inject(Auth0Service);
  private readonly userStore = inject(CurrentUserStore);

  readonly isAuthenticated$: Observable<boolean> = this.auth0.isAuthenticated$;
  readonly user$: Observable<User | null | undefined> = this.auth0.user$;
  readonly isLoading$: Observable<boolean> = this.auth0.isLoading$;

  constructor() {
    this.auth0.user$.subscribe((user) => {
      if (user) {
        // Initial state from external identity; roles remain empty until GET /users/me is called
        this.userStore.setUser({
          id: '', // Will be populated by backend GET /users/me
          externalId: user.sub ?? '',
          email: user.email ?? '',
          name: user.name ?? '',
          roles: [] // Authoritative roles sourced strictly from backend
        });
      } else {
        this.userStore.clear();
      }
    });

    this.auth0.isLoading$.subscribe((loading) => {
      this.userStore.setLoading(loading);
    });
  }

  loginWithRedirect(): Observable<void> {
    return this.auth0.loginWithRedirect();
  }

  logout(): Observable<void> {
    this.userStore.clear();
    return this.auth0.logout({
      logoutParams: {
        returnTo: typeof window !== 'undefined' ? window.location.origin : ''
      }
    });
  }

  getAccessTokenSilently(): Observable<string> {
    return this.auth0.getAccessTokenSilently();
  }

  /**
   * Stub for backend user profile integration (GET /users/me).
   * In future phases, this method will query the FixUp API with the Auth0 token
   * and load the user's internal ID, status, and backend-authorized roles.
   */
  loadBackendUserProfile(): void {
    // Contract to be implemented with backend /users/me client in future phases
  }
}
