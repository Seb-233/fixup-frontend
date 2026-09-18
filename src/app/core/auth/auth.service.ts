import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService as Auth0Service, User } from '@auth0/auth0-angular';
import { BehaviorSubject, Observable, catchError, combineLatest, distinctUntilChanged, filter, map, of, shareReplay, switchMap, tap } from 'rxjs';
import { AuthApiService } from '../../api/auth-api.service';
import { BackendUserProfile, Role, SelfSelectableRole } from './auth.types';
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
  readonly error$: Observable<Error> = this.auth0.error$;
  readonly appState$: Observable<{ target?: string } | undefined> = this.auth0.appState$;

  // Gatillo reiniciable para la sesión compartida
  private readonly initTrigger$ = new BehaviorSubject<void>(undefined);

  // Flujo observable compartido y reactivo para la inicialización y bootstrap con el backend
  readonly sessionReady$: Observable<BackendUserProfile | null> = this.initTrigger$.pipe(
    switchMap(() =>
      combineLatest([this.auth0.isLoading$, this.auth0.isAuthenticated$]).pipe(
        filter(([loading]) => !loading),
        map(([, authenticated]) => authenticated),
        distinctUntilChanged(),
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
            }),
            catchError((error) => {
              this.userStore.setLoading(false);
              this.userStore.setError(error?.message ?? 'Error inicializando sesión');
              return of(null);
            })
          );
        })
      )
    ),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  constructor() {
    this.sessionReady$.subscribe();
  }

  // Redirige al login de Auth0 preservando un target interno validado
  loginWithRedirect(targetUrl?: string): Observable<void> {
    const safeTarget =
      targetUrl && targetUrl.startsWith('/') && !targetUrl.startsWith('//')
        ? targetUrl
        : '/dashboard';

    return this.auth0.loginWithRedirect({
      appState: { target: safeTarget }
    });
  }

  // Cierra sesión limpiando el store local, reiniciando el flujo observable y regresando a /auth/login
  logout(): Observable<void> {
    this.userStore.clear();
    this.initTrigger$.next();
    const returnTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/auth/login`
        : 'http://localhost:4200/auth/login';

    return this.auth0.logout({
      logoutParams: {
        returnTo
      }
    });
  }

  getAccessTokenSilently(): Observable<string> {
    return this.auth0.getAccessTokenSilently();
  }

  // Selecciona y activa uno de los roles disponibles devueltos por el backend
  selectRole(role: Role): void {
    this.userStore.setActiveRole(role);
    this.router.navigate(['/dashboard']);
  }

  // Asigna un rol inicial en el backend si es necesario y sincroniza el perfil
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
        this.userStore.setActiveRole(role);
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
