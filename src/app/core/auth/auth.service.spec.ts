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
    loginWithRedirect: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    getAccessTokenSilently: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    auth0Mock = {
      isAuthenticated$: new BehaviorSubject<boolean>(false),
      user$: new BehaviorSubject<User | null>(null),
      isLoading$: new BehaviorSubject<boolean>(false),
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

  it('debe iniciar la redirección hacia Auth0 al invocar loginWithRedirect()', () => {
    service.loginWithRedirect();
    expect(auth0Mock.loginWithRedirect).toHaveBeenCalled();
  });

  it('debe ejecutar el flujo bootstrap -> getMe cuando Auth0 indica isAuthenticated = true', () => {
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

    // Emitir sesión autenticada
    auth0Mock.isAuthenticated$.next(true);

    expect(authApiMock.bootstrap).toHaveBeenCalled();
    expect(authApiMock.getMe).toHaveBeenCalled();
    expect(userStore.user()?.displayName).toBe('Usuario Existente');
    expect(userStore.roles()).toEqual(['OWNER']);
  });

  it('debe redirigir a /auth/select-role si el usuario autenticado tiene roles vacío', () => {
    const mockBootstrap: BootstrapResponse = {
      id: 'uuid-new',
      displayName: 'Nuevo Usuario',
      status: 'ACTIVE',
      roles: []
    };
    const mockMe: UserResponse = {
      id: 'uuid-new',
      email: 'nuevo@fixup.com',
      displayName: 'Nuevo Usuario',
      status: 'ACTIVE',
      roles: []
    };

    authApiMock.bootstrap.mockReturnValue(of(mockBootstrap));
    authApiMock.getMe.mockReturnValue(of(mockMe));

    auth0Mock.isAuthenticated$.next(true);

    expect(routerNavigateSpy).toHaveBeenCalledWith(['/auth/select-role']);
  });

  it('debe asignar el rol inicial mediante selectInitialRole y actualizar el store', () => {
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
      expect(routerNavigateSpy).toHaveBeenCalledWith(['/dashboard']);
    });

    expect(authApiMock.selectInitialRole).toHaveBeenCalledWith('TENANT');
  });

  it('debe limpiar el CurrentUserStore y delegar el cierre a Auth0 en logout()', () => {
    userStore.setProfile({
      id: 'uuid-1',
      email: 'c@fixup.com',
      displayName: 'Carlos',
      status: 'ACTIVE',
      roles: ['OWNER']
    });

    service.logout();

    expect(userStore.user()).toBeNull();
    expect(auth0Mock.logout).toHaveBeenCalled();
  });
});
