import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';
import { vi } from 'vitest';
import { authGuard } from './auth.guard';
import { roleGuard } from './role.guard';
import { AuthService } from './auth.service';
import { CurrentUserStore } from './current-user.store';
import { BackendUserProfile } from './auth.types';

describe('Guards de Autenticación y Roles', () => {
  let userStore: CurrentUserStore;
  let routerNavigateSpy: ReturnType<typeof vi.fn>;
  let authServiceMock: {
    isLoading$: Observable<boolean>;
    sessionReady$: Observable<BackendUserProfile | null>;
  };

  const mockRoute = { data: {} } as unknown as ActivatedRouteSnapshot;
  const mockState = { url: '/properties' } as RouterStateSnapshot;

  beforeEach(() => {
    routerNavigateSpy = vi.fn();
    authServiceMock = {
      isLoading$: of(false),
      sessionReady$: of(null)
    };

    TestBed.configureTestingModule({
      providers: [
        CurrentUserStore,
        { provide: AuthService, useValue: authServiceMock },
        { provide: Router, useValue: { navigate: routerNavigateSpy } }
      ]
    });

    userStore = TestBed.inject(CurrentUserStore);
  });

  describe('authGuard (Requerimiento 10)', () => {
    it('debe permitir la navegación si el perfil ya está cargado y autenticado', () => {
      userStore.setProfile({
        id: 'uuid-1',
        email: 'user@fixup.com',
        displayName: 'User',
        status: 'ACTIVE',
        roles: ['OWNER']
      });

      const result = TestBed.runInInjectionContext(() => authGuard(mockRoute, mockState));
      expect(result).toBe(true);
    });

    it('debe esperar isLoading$ = false y redirigir a /auth/login con returnUrl si no hay sesión', async () => {
      authServiceMock.isLoading$ = of(false);
      authServiceMock.sessionReady$ = of(null);

      const observableResult = TestBed.runInInjectionContext(() =>
        authGuard(mockRoute, mockState)
      ) as Observable<boolean>;
      const canActivate = await firstValueFrom(observableResult);
      expect(canActivate).toBe(false);
      expect(routerNavigateSpy).toHaveBeenCalledWith(['/auth/login'], {
        queryParams: { returnUrl: '/properties' }
      });
    });

    it('debe permitir acceso cuando sessionReady$ resuelve un perfil autenticado', async () => {
      const profile: BackendUserProfile = {
        id: 'uuid-1',
        email: 'user@fixup.com',
        displayName: 'User',
        status: 'ACTIVE',
        roles: ['OWNER']
      };
      userStore.clear();
      userStore.setProfile(profile);
      authServiceMock.sessionReady$ = of(profile);

      const result = TestBed.runInInjectionContext(() =>
        authGuard(mockRoute, mockState)
      );
      const canActivate = typeof result === 'boolean' ? result : await firstValueFrom(result as Observable<boolean>);
      expect(canActivate).toBe(true);
    });
  });

  describe('roleGuard (Requerimientos 11 y 12)', () => {
    it('11. debe permitir acceso si el usuario cuenta con el rol activo requerido vía route.data', () => {
      userStore.setProfile({
        id: 'uuid-1',
        email: 'owner@fixup.com',
        displayName: 'Owner User',
        status: 'ACTIVE',
        roles: ['OWNER']
      });
      userStore.setActiveRole('OWNER');

      const routeWithRoles = {
        data: { roles: ['OWNER', 'TENANT'] }
      } as unknown as ActivatedRouteSnapshot;

      const canActivate = TestBed.runInInjectionContext(() =>
        roleGuard(routeWithRoles, mockState)
      );
      expect(canActivate).toBe(true);
    });

    it('11. debe redirigir a /auth/access-denied si el rol activo no coincide con route.data', () => {
      userStore.setProfile({
        id: 'uuid-1',
        email: 'tenant@fixup.com',
        displayName: 'Tenant User',
        status: 'ACTIVE',
        roles: ['TENANT']
      });
      userStore.setActiveRole('TENANT');

      const routeWithOwnerOnly = {
        data: { roles: ['OWNER'] }
      } as unknown as ActivatedRouteSnapshot;

      const canActivate = TestBed.runInInjectionContext(() =>
        roleGuard(routeWithOwnerOnly, mockState)
      );
      expect(canActivate).toBe(false);
      expect(routerNavigateSpy).toHaveBeenCalledWith(['/auth/access-denied']);
    });

    it('debe redirigir a /auth/select-role si el usuario tiene roles pero activeRole es null', () => {
      userStore.setProfile({
        id: 'uuid-1',
        email: 'owner@fixup.com',
        displayName: 'Owner User',
        status: 'ACTIVE',
        roles: ['OWNER', 'TENANT']
      });
      userStore.setActiveRole(null);

      const routeWithRoles = {
        data: { roles: ['OWNER'] }
      } as unknown as ActivatedRouteSnapshot;

      const canActivate = TestBed.runInInjectionContext(() =>
        roleGuard(routeWithRoles, mockState)
      );
      expect(canActivate).toBe(false);
      expect(routerNavigateSpy).toHaveBeenCalledWith(['/auth/select-role']);
    });

    it('debe redirigir a /auth/select-role si el usuario autenticado tiene lista de roles vacía', () => {
      userStore.setProfile({
        id: 'uuid-new',
        email: 'new@fixup.com',
        displayName: 'Nuevo',
        status: 'ACTIVE',
        roles: []
      });

      const routeWithRoles = {
        data: { roles: ['OWNER'] }
      } as unknown as ActivatedRouteSnapshot;

      const canActivate = TestBed.runInInjectionContext(() =>
        roleGuard(routeWithRoles, mockState)
      );
      expect(canActivate).toBe(false);
      expect(routerNavigateSpy).toHaveBeenCalledWith(['/auth/select-role']);
    });

    it('12. debe redirigir a /auth/account-restricted si el estado de la cuenta es SUSPENDED o DISABLED', () => {
      userStore.setProfile({
        id: 'uuid-1',
        email: 'suspended@fixup.com',
        displayName: 'Suspended User',
        status: 'SUSPENDED',
        roles: ['OWNER']
      });
      userStore.setActiveRole('OWNER');

      const routeWithRoles = {
        data: { roles: ['OWNER'] }
      } as unknown as ActivatedRouteSnapshot;

      const canActivate = TestBed.runInInjectionContext(() =>
        roleGuard(routeWithRoles, mockState)
      );
      expect(canActivate).toBe(false);
      expect(routerNavigateSpy).toHaveBeenCalledWith(['/auth/account-restricted']);
    });
  });
});
