import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService as Auth0Service, User } from '@auth0/auth0-angular';
import { BehaviorSubject, Observable, catchError, combineLatest, distinctUntilChanged, filter, from, map, of, shareReplay, switchMap, take, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthApiService } from '../../api/auth-api.service';
import { BackendUserProfile, Role, SelectableRole } from './auth.types';
import { CurrentUserStore } from './current-user.store';
import { NotificationsStore } from '../notifications/notifications.store';
import { nativeLogoutUrl } from './native-callback';
import { NativeAuthService } from './native-auth.service';
import { DemoAccount, DemoSession } from '../demo/demo-session';
import { KnownPaymentsService } from '../../data/known-payments';

// Servicio de autenticación que orquesta Auth0 y la sincronización con el backend
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly auth0 = inject(Auth0Service);
  private readonly authApi = inject(AuthApiService);
  private readonly userStore = inject(CurrentUserStore);
  private readonly notificationsStore = inject(NotificationsStore);
  private readonly knownPayments = inject(KnownPaymentsService);
  private readonly router = inject(Router);
  private readonly native = inject(NativeAuthService);
  private readonly demo = inject(DemoSession);

  // La sesión de demostración se publica como observable para combinarla con el estado de Auth0.
  private readonly demoSubject$ = new BehaviorSubject<string | null>(this.demo.current()?.subject ?? null);

  // Estado de autenticación unificado: una sesión demo vigente cuenta como autenticada sin esperar
  // a Auth0; sin ella manda Auth0.
  private readonly authState$ = combineLatest([
    this.auth0.isLoading$,
    this.auth0.isAuthenticated$,
    this.demoSubject$
  ]).pipe(
    map(([loading, authenticated, demoSubject]) =>
      demoSubject
        ? { loading: false, authenticated: true, key: `demo:${demoSubject}` }
        : { loading, authenticated, key: authenticated ? 'auth0' : 'anonymous' }
    ),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  readonly isAuthenticated$: Observable<boolean> = this.authState$.pipe(map((state) => state.authenticated));
  readonly user$: Observable<User | null | undefined> = this.auth0.user$;
  readonly isLoading$: Observable<boolean> = this.authState$.pipe(map((state) => state.loading));
  readonly error$: Observable<Error> = this.auth0.error$;
  readonly appState$: Observable<{ target?: string } | undefined> = this.auth0.appState$;

  // Identidad que produjo el último valor de sessionReady$: permite distinguir el perfil recién
  // cargado del que quedó en caché de la cuenta anterior.
  private sessionKey: string | null = null;

  // Gatillo reiniciable para la sesión compartida
  private readonly initTrigger$ = new BehaviorSubject<void>(undefined);

  // Flujo observable compartido y reactivo para la inicialización y bootstrap con el backend.
  // Se reinicia cuando cambia la identidad (otra cuenta demo, o Auth0 en lugar de demo).
  readonly sessionReady$: Observable<BackendUserProfile | null> = this.initTrigger$.pipe(
    switchMap(() =>
      this.authState$.pipe(
        filter((state) => !state.loading),
        distinctUntilChanged((a, b) => a.key === b.key),
        switchMap((state) => {
          if (!state.authenticated) {
            this.userStore.clear();
            this.sessionKey = state.key;
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
              // Al recargar manda el rol que la persona eligió; en un ingreso demo nuevo, el de la cuenta.
              const demoRole = this.demo.current()?.role;
              if (!this.userStore.restoreRememberedRole() && demoRole && profile.roles.includes(demoRole)) {
                this.userStore.setActiveRole(demoRole);
              }
              this.userStore.setLoading(false);
              this.sessionKey = state.key;
            }),
            catchError((error) => {
              this.userStore.setLoading(false);
              this.userStore.setError(error?.message ?? 'Error inicializando sesión');
              this.sessionKey = state.key;
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

  /** Entra con una de las cuentas de demostración del backend local (perfil demo). */
  loginAsDemo(account: DemoAccount): Observable<BackendUserProfile | null> {
    // Nada de la cuenta anterior (perfil, rol activo, avisos) debe sobrevivir al cambio de cuenta.
    this.userStore.clear();
    this.notificationsStore.resetForNewSession();
    this.sessionKey = null;
    return this.demo.start(account).pipe(
      switchMap((state) => {
        this.userStore.setError(null);
        this.demoSubject$.next(state.subject);
        // Reinicia la carga del perfil aunque sea la misma cuenta que ya estaba abierta.
        this.initTrigger$.next();
        const key = `demo:${state.subject}`;
        return this.sessionReady$.pipe(
          filter(() => this.sessionKey === key),
          take(1)
        );
      })
    );
  }

  get isDemo(): boolean {
    return this.demo.current() !== null;
  }

  // Cierra sesión limpiando el store local, reiniciando el flujo observable y regresando a /auth/login
  logout(): Observable<void> {
    this.userStore.clear();
    this.notificationsStore.resetForNewSession();
    this.knownPayments.clearSessionFinancialData();
    if (this.demo.current()) {
      this.demo.end();
      this.demoSubject$.next(null);
      this.initTrigger$.next();
      return from(this.router.navigate(['/auth/login'])).pipe(map(() => undefined));
    }
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
