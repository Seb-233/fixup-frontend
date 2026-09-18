import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService as Auth0Service, User } from '@auth0/auth0-angular';
import { BehaviorSubject, Observable, catchError, map, of, shareReplay, switchMap, tap } from 'rxjs';
import { AuthApiService } from '../../api/auth-api.service';
import { BackendUserProfile, SelfSelectableRole } from './auth.types';
import { CurrentUserStore } from './current-user.store';

// Servicio de autenticación que orquesta Auth0 y la sincronización con el backend
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly auth0 = inject(Auth0Service);
  private readonly authApi = inject(AuthApiService);
  private readonly userStore = inject(CurrentUserStore);
  private readonly router = inject(Router);

  readonly isAuthenticated$: Observable<boolean> = this.auth0.isAuthenticated$;
  readonly user$: Observable<User | null | undefined> = this.auth0.user$;
  readonly isLoading$: Observable<boolean> = this.auth0.isLoading$;

  // Gatillo reiniciable para la sesión compartida
  private readonly initTrigger$ = new BehaviorSubject<void>(undefined);

  // Flujo observable compartido y reactivo para la inicialización y bootstrap con el backend
  readonly sessionReady$: Observable<BackendUserProfile | null> = this.initTrigger$.pipe(
    switchMap(() => this.auth0.isAuthenticated$),
    switchMap((authenticated) => {
      if (!authenticated) {
        this.userStore.clear();
        return of(null);
      }

      this.userStore.setLoading(true);

      return this.authApi.bootstrap().pipe(
        switchMap(() => this.authApi.getMe()),
        map((response): BackendUserProfile => ({
          id: response.id,
          email: response.email ?? null,
          displayName: response.displayName ?? '',
          status: response.status,
          roles: response.roles
        })),
        tap((profile) => {
          this.userStore.setProfile(profile);
          this.userStore.setLoading(false);

          // Navegar a selección de rol solo si el usuario no tiene roles asignados
          if (profile.roles.length === 0) {
            this.router.navigate(['/auth/select-role']);
          } else if (profile.status === 'SUSPENDED' || profile.status === 'DISABLED') {
            this.router.navigate(['/auth/account-restricted']);
          }
        }),
        catchError((error) => {
          this.userStore.setLoading(false);
          this.userStore.setError(error?.message ?? 'Error inicializando sesión');
          return of(null);
        })
      );
    }),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  constructor() {
    this.sessionReady$.subscribe();
  }

  loginWithRedirect(): Observable<void> {
    return this.auth0.loginWithRedirect();
  }

  // Cierra sesión limpiando el store local y reiniciando el flujo observable
  logout(): Observable<void> {
    this.userStore.clear();
    this.initTrigger$.next();
    return this.auth0.logout({
      logoutParams: {
        returnTo: typeof window !== 'undefined' ? window.location.origin : ''
      }
    });
  }

  getAccessTokenSilently(): Observable<string> {
    return this.auth0.getAccessTokenSilently();
  }

  // Asigna el rol inicial y sincroniza inmediatamente el perfil actualizado
  selectInitialRole(role: SelfSelectableRole): Observable<BackendUserProfile> {
    this.userStore.setLoading(true);
    return this.authApi.selectInitialRole(role).pipe(
      switchMap(() => this.authApi.getMe()),
      map((response): BackendUserProfile => ({
        id: response.id,
        email: response.email ?? null,
        displayName: response.displayName ?? '',
        status: response.status,
        roles: response.roles
      })),
      tap((profile) => {
        this.userStore.setProfile(profile);
        this.userStore.setLoading(false);
        this.router.navigate(['/dashboard']);
      }),
      catchError((err) => {
        this.userStore.setLoading(false);
        throw err;
      })
    );
  }
}
