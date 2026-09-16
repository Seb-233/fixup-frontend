import { Injectable, inject } from '@angular/core';
import { AuthService as Auth0Service, User } from '@auth0/auth0-angular';
import { Observable } from 'rxjs';
import { CurrentUserStore } from './current-user.store';

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
        this.userStore.setUser({
          id: user.sub ?? '',
          email: user.email ?? '',
          name: user.name ?? '',
          roles: (user['https://fixup.app/roles'] as string[]) ?? []
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
}
