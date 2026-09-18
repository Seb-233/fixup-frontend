import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService as Auth0Service, User } from '@auth0/auth0-angular';
import { BehaviorSubject, of } from 'rxjs';
import { vi } from 'vitest';
import { AuthApiService } from '../../api/auth-api.service';
import { AuthService } from './auth.service';
import { CurrentUserStore } from './current-user.store';
import { BootstrapResponse, RolesResponse, UserResponse } from './auth.types';

describe('AuthService', () => {
  let service: AuthService;
  let userStore: CurrentUserStore;
  let routerNavigateSpy: ReturnType<typeof vi.fn>;
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
        { provide: Router, useValue: { navigate: routerNavigateSpy } }
      ]
    });

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

  it('9. la selección de rol inicial debe consumir POST /auth/select-role', () => {
    const mockRolesResponse: RolesResponse = { roles: ['TENANT'] };
    const mockMeResponse: UserResponse = {
      id: 'uuid-1',
      email: 'tenant@fixup.com',
      displayName: 'Inquilino',
      status: 'ACTIVE',
      roles: ['TENANT']
    };

    authApiMock.selectInitialRole.mockReturnValue(of(mockRolesResponse));
    authApiMock.getMe.mockReturnValue(of(mockMeResponse));

    service.selectInitialRole('TENANT').subscribe((profile) => {
      expect(profile.roles).toEqual(['TENANT']);
      expect(userStore.roles()).toEqual(['TENANT']);
      expect(userStore.activeRole()).toBe('TENANT');
      expect(routerNavigateSpy).toHaveBeenCalledWith(['/dashboard']);
    });

    expect(authApiMock.selectInitialRole).toHaveBeenCalledWith('TENANT');
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
});
