import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService as Auth0Service, User } from '@auth0/auth0-angular';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthApiService } from '../../api/auth-api.service';
import { AuthService } from './auth.service';
import { CurrentUserStore } from './current-user.store';
import { BootstrapResponse, RolesResponse, UserResponse } from './auth.types';
import { DEMO_ACCOUNTS, DemoSession, DemoSessionState } from '../demo/demo-session';
import { signal } from '@angular/core';

describe('AuthService', () => {
  let service: AuthService;
  let userStore: CurrentUserStore;
  let routerNavigateSpy: ReturnType<typeof vi.fn>;
  const demoState = signal<DemoSessionState | null>(null);
  const demoMock = {
    current: demoState.asReadonly(),
    enabled: true,
    start: vi.fn(),
    end: vi.fn(() => demoState.set(null))
  };
  let authApiMock: {
    bootstrap: ReturnType<typeof vi.fn>;
    getMe: ReturnType<typeof vi.fn>;
    selectInitialRole: ReturnType<typeof vi.fn>;
  };
  let auth0Mock: {
    isAuthenticated$: BehaviorSubject<boolean>;
    user$: BehaviorSubject<User | null>;
    isLoading$: BehaviorSubject<boolean>;
    error$: BehaviorSubject<Error>;
    appState$: BehaviorSubject<{ target?: string } | undefined>;
    loginWithRedirect: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    getAccessTokenSilently: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    auth0Mock = {
      isAuthenticated$: new BehaviorSubject<boolean>(false),
      user$: new BehaviorSubject<User | null>(null),
      isLoading$: new BehaviorSubject<boolean>(false),
      error$: new BehaviorSubject<Error>(new Error()),
      appState$: new BehaviorSubject<{ target?: string } | undefined>(undefined),
      loginWithRedirect: vi.fn().mockReturnValue(of(undefined)),
      logout: vi.fn().mockReturnValue(of(undefined)),
      getAccessTokenSilently: vi.fn().mockReturnValue(of('mock-token'))
    };

    authApiMock = {
      bootstrap: vi.fn(),
      getMe: vi.fn(),
      selectInitialRole: vi.fn()
    };

    routerNavigateSpy = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        CurrentUserStore,
        { provide: Auth0Service, useValue: auth0Mock },
        { provide: AuthApiService, useValue: authApiMock },
        { provide: Router, useValue: { navigate: routerNavigateSpy } },
        { provide: DemoSession, useValue: demoMock }
      ]
    });
    sessionStorage.clear();
    demoState.set(null);

    service = TestBed.inject(AuthService);
    userStore = TestBed.inject(CurrentUserStore);
  });

  it('5. debe enviar appState con target sanitizado en loginWithRedirect()', () => {
    service.loginWithRedirect('/properties');
    expect(auth0Mock.loginWithRedirect).toHaveBeenCalledWith({
      appState: { target: '/properties' }
    });

    service.loginWithRedirect('//evil.com');
    expect(auth0Mock.loginWithRedirect).toHaveBeenCalledWith({
      appState: { target: '/dashboard' }
    });
  });

  it('7. debe ejecutar bootstrap y luego me cuando Auth0 autentica', () => {
    const mockBootstrap: BootstrapResponse = {
      id: 'uuid-1',
      displayName: 'Usuario Existente',
      status: 'ACTIVE',
      roles: ['OWNER']
    };
    const mockMe: UserResponse = {
      id: 'uuid-1',
      email: 'owner@fixup.com',
      displayName: 'Usuario Existente',
      status: 'ACTIVE',
      roles: ['OWNER']
    };

    authApiMock.bootstrap.mockReturnValue(of(mockBootstrap));
    authApiMock.getMe.mockReturnValue(of(mockMe));

    // Emitir fin de carga y autenticación exitosa
    auth0Mock.isLoading$.next(false);
    auth0Mock.isAuthenticated$.next(true);

    expect(authApiMock.bootstrap).toHaveBeenCalled();
    expect(authApiMock.getMe).toHaveBeenCalled();
    expect(userStore.user()?.displayName).toBe('Usuario Existente');
    expect(userStore.roles()).toEqual(['OWNER']);
  });

  it('8. la inicialización compartida no debe duplicar solicitudes ante múltiples suscriptores', () => {
    const mockBootstrap: BootstrapResponse = {
      id: 'uuid-1',
      displayName: 'Usuario Existente',
      status: 'ACTIVE',
      roles: ['OWNER']
    };
    const mockMe: UserResponse = {
      id: 'uuid-1',
      email: 'owner@fixup.com',
      displayName: 'Usuario Existente',
      status: 'ACTIVE',
      roles: ['OWNER']
    };

    authApiMock.bootstrap.mockReturnValue(of(mockBootstrap));
    authApiMock.getMe.mockReturnValue(of(mockMe));

    auth0Mock.isLoading$.next(false);
    auth0Mock.isAuthenticated$.next(true);

    // Múltiples suscriptores concurrentes a sessionReady$
    service.sessionReady$.subscribe();
    service.sessionReady$.subscribe();
    service.sessionReady$.subscribe();

    expect(authApiMock.bootstrap).toHaveBeenCalledTimes(1);
    expect(authApiMock.getMe).toHaveBeenCalledTimes(1);
  });

  it('4, 5, 6, 7 y 8. la selección de rol ejecuta una única llamada a select-role, re-consulta me, actualiza el store y redirige a dashboard', () => {
    const mockRolesResponse: RolesResponse = { roles: ['OWNER'] };
    const mockMeResponse: UserResponse = {
      id: 'uuid-1',
      email: 'owner@fixup.com',
      displayName: 'Propietario Nuevo',
      status: 'ACTIVE',
      roles: ['OWNER']
    };

    authApiMock.selectInitialRole.mockReturnValue(of(mockRolesResponse));
    authApiMock.getMe.mockReturnValue(of(mockMeResponse));

    service.selectInitialRole('OWNER').subscribe((profile) => {
      // 7. El store se actualiza con el rol retornado
      expect(profile.roles).toEqual(['OWNER']);
      expect(userStore.roles()).toEqual(['OWNER']);
      expect(userStore.activeRole()).toBe('OWNER');
      // 8. El usuario es redirigido a /dashboard
      expect(routerNavigateSpy).toHaveBeenCalledWith(['/dashboard']);
    });

    // 4. La selección ejecuta una única llamada a select-role
    expect(authApiMock.selectInitialRole).toHaveBeenCalledTimes(1);
    // 5. El valor coincide con el rol seleccionado
    expect(authApiMock.selectInitialRole).toHaveBeenCalledWith('OWNER');
    // 6. Después del éxito se consulta nuevamente /auth/me
    expect(authApiMock.getMe).toHaveBeenCalledTimes(1);
  });

  it('10. los errores 400, 403 o 409 de selectInitialRole preservan los roles locales sin modificar', () => {
    userStore.setRoles([]);
    authApiMock.selectInitialRole.mockReturnValue(
      throwError(() => ({
        status: 409,
        error: { code: 'CONFLICT', message: 'Rol ya asignado previamente' }
      }))
    );

    let caughtError: unknown = null;
    service.selectInitialRole('TENANT').subscribe({
      error: (err) => {
        caughtError = err;
      }
    });

    expect(caughtError).toBeTruthy();
    expect(userStore.roles()).toEqual([]);
    expect(userStore.error()).toBe('Rol ya asignado previamente');
    expect(authApiMock.getMe).not.toHaveBeenCalled();
    expect(routerNavigateSpy).not.toHaveBeenCalled();
  });

  it('debe activar un rol existente mediante selectRole() sin llamar al backend', () => {
    userStore.setProfile({
      id: 'uuid-1',
      email: 'c@fixup.com',
      displayName: 'Carlos',
      status: 'ACTIVE',
      roles: ['OWNER', 'TENANT']
    });

    service.selectRole('OWNER');

    expect(userStore.activeRole()).toBe('OWNER');
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/dashboard']);
  });

  it('15. logout debe limpiar completamente el store y reiniciar el flujo compartido', () => {
    userStore.setProfile({
      id: 'uuid-1',
      email: 'c@fixup.com',
      displayName: 'Carlos',
      status: 'ACTIVE',
      roles: ['OWNER']
    });
    userStore.setActiveRole('OWNER');

    service.logout();

    expect(userStore.user()).toBeNull();
    expect(userStore.activeRole()).toBeNull();
    expect(userStore.roles()).toEqual([]);
    expect(auth0Mock.logout).toHaveBeenCalled();
  });

  it('el ingreso demo abre la sesión con el rol de la cuenta elegida aunque tenga varios', async () => {
    const manager = DEMO_ACCOUNTS.find((account) => account.role === 'REAL_ESTATE_MANAGER')!;
    const state: DemoSessionState = { token: 't', subject: manager.subject, name: manager.name, role: manager.role, expiresAt: Date.now() + 60000 };
    demoMock.start.mockImplementation(() => {
      demoState.set(state);
      return of(state);
    });
    const profile: UserResponse = { id: 'uuid-m', email: 'contacto@cordillera.test', displayName: manager.name, status: 'ACTIVE', roles: ['OWNER', 'REAL_ESTATE_MANAGER'] };
    authApiMock.bootstrap.mockReturnValue(of(profile));
    authApiMock.getMe.mockReturnValue(of(profile));

    const result = await new Promise((resolve) => service.loginAsDemo(manager).subscribe(resolve));

    expect(result).toMatchObject({ id: 'uuid-m' });
    expect(userStore.activeRole()).toBe('REAL_ESTATE_MANAGER');
    expect(service.isDemo).toBe(true);
    expect(auth0Mock.loginWithRedirect).not.toHaveBeenCalled();
  });

  it('cerrar una sesión demo no pasa por Auth0', () => {
    demoState.set({ token: 't', subject: 'auth0|demo-owner', name: 'X', role: 'OWNER', expiresAt: Date.now() + 60000 });
    routerNavigateSpy.mockReturnValue(Promise.resolve(true));
    service.logout().subscribe();
    expect(demoMock.end).toHaveBeenCalled();
    expect(auth0Mock.logout).not.toHaveBeenCalled();
    expect(routerNavigateSpy).toHaveBeenCalledWith(['/auth/login']);
  });
});
