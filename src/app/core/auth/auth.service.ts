import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService as Auth0Service, User } from '@auth0/auth0-angular';
import { BehaviorSubject, Observable, catchError, combineLatest, distinctUntilChanged, filter, map, of, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthApiService } from '../../api/auth-api.service';
import { BackendUserProfile, Role, SelectableRole } from './auth.types';
import { CurrentUserStore } from './current-user.store';
import { nativeLogoutUrl } from './native-callback';
import { NativeAuthService } from './native-auth.service';

// Servicio de autenticación que orquesta Auth0 y la sincronización con el backend
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly auth0 = inject(Auth0Service);
  private readonly authApi = inject(AuthApiService);
  private readonly userStore = inject(CurrentUserStore);
  private readonly router = inject(Router);
  private readonly native = inject(NativeAuthService);

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

  // Redirige al login de Auth0 preservando un target interno validado.
  // En Android la ventana se abre en el navegador del sistema (FR-UC-21).
  loginWithRedirect(targetUrl?: string): Observable<void> {
    const safeTarget =
      targetUrl && targetUrl.startsWith('/') && !targetUrl.startsWith('//')
        ? targetUrl
        : '/dashboard';

    return this.auth0.loginWithRedirect({
      appState: { target: safeTarget },
      ...(this.native.enabled ? { openUrl: this.native.openUrl } : {})
    });
  }

  // Cierra sesión limpiando el store local, reiniciando el flujo observable y regresando a /auth/login
  logout(): Observable<void> {
    this.userStore.clear();
    this.initTrigger$.next();
    const returnTo = this.native.enabled
      ? nativeLogoutUrl(environment.native.appId, environment.auth0.domain)
      : typeof window !== 'undefined'
        ? `${window.location.origin}/auth/login`
        : 'http://localhost:4200/auth/login';

    return this.auth0.logout({
      logoutParams: {
        returnTo
      },
      ...(this.native.enabled ? { openUrl: this.native.openUrl } : {})
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

  // Asigna un rol inicial en el backend para una cuenta nueva y sincroniza el perfil
  selectInitialRole(role: SelectableRole): Observable<BackendUserProfile> {
    this.userStore.setLoading(true);
    this.userStore.setError(null);

    // 4 y 5. Ejecuta una única llamada a POST /auth/select-role con { role: selectedRole }
    return this.authApi.selectInitialRole(role).pipe(
      tap((rolesResponse) => {
        // 1. Actualizar el store con la respuesta
        if (rolesResponse?.roles) {
          this.userStore.setRoles(rolesResponse.roles);
        }
      }),
      // 2. Ejecutar nuevamente GET /auth/me para sincronizar el perfil definitivo
      switchMap(() => this.authApi.getMe()),
      map((response): BackendUserProfile => {
        // 3. Confirmar que roles contiene el rol seleccionado
        const roles = response.roles && response.roles.length > 0 ? response.roles : [role];
        return {
          id: response.id,
          email: response.email ?? null,
          displayName: response.displayName ?? '',
          status: response.status,
          roles
        };
      }),
      tap((profile) => {
        // 4. Establecer el rol de sesión según el contrato real
        this.userStore.setProfile(profile);
        this.userStore.setActiveRole(role);
        this.userStore.setLoading(false);
        // 5. Redirigir a /dashboard
        this.router.navigate(['/dashboard']);
      }),
      catchError((err: unknown) => {
        this.userStore.setLoading(false);
        // 10. Los errores 400, 403 o 409 del backend se muestran sin modificar localmente los roles
        const errorObj = err as { error?: { message?: string; code?: string }; message?: string };
        const msg =
          errorObj.error?.message ||
          errorObj.error?.code ||
          errorObj.message ||
          'Error asignando el rol inicial';
        this.userStore.setError(msg);
        return throwError(() => err);
      })
    );
  }
}
