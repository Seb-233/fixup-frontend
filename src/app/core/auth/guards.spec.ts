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
    sessionReady$: Observable<BackendUserProfile | null>;
  };

  const mockRoute = {} as ActivatedRouteSnapshot;
  const mockState = {} as RouterStateSnapshot;

  beforeEach(() => {
    routerNavigateSpy = vi.fn();
    authServiceMock = {
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

  describe('authGuard', () => {
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

    it('debe redirigir a /auth/login si la sesión no está autenticada', async () => {
      authServiceMock.sessionReady$ = of(null);

      const observableResult = TestBed.runInInjectionContext(() =>
        authGuard(mockRoute, mockState)
      ) as Observable<boolean>;
      const canActivate = await firstValueFrom(observableResult);
      expect(canActivate).toBe(false);
      expect(routerNavigateSpy).toHaveBeenCalledWith(['/auth/login']);
    });
  });

  describe('roleGuard', () => {
    it('debe permitir acceso si el usuario cuenta con el rol requerido', () => {
      userStore.setProfile({
        id: 'uuid-1',
        email: 'owner@fixup.com',
        displayName: 'Owner User',
        status: 'ACTIVE',
        roles: ['OWNER']
      });

      const guard = roleGuard(['OWNER']);
      const canActivate = TestBed.runInInjectionContext(() => guard(mockRoute, mockState));
      expect(canActivate).toBe(true);
    });

    it('debe redirigir a /auth/access-denied si el usuario no cuenta con el rol requerido', () => {
      userStore.setProfile({
        id: 'uuid-1',
        email: 'tenant@fixup.com',
        displayName: 'Tenant User',
        status: 'ACTIVE',
        roles: ['TENANT']
      });

      const guard = roleGuard(['OWNER']);
      const canActivate = TestBed.runInInjectionContext(() => guard(mockRoute, mockState));
      expect(canActivate).toBe(false);
      expect(routerNavigateSpy).toHaveBeenCalledWith(['/auth/access-denied']);
    });

    it('debe redirigir a /auth/select-role si el usuario autenticado tiene lista de roles vacía', () => {
      userStore.setProfile({
        id: 'uuid-new',
        email: 'new@fixup.com',
        displayName: 'Nuevo',
        status: 'ACTIVE',
        roles: []
      });

      const guard = roleGuard(['OWNER', 'TENANT']);
      const canActivate = TestBed.runInInjectionContext(() => guard(mockRoute, mockState));
      expect(canActivate).toBe(false);
      expect(routerNavigateSpy).toHaveBeenCalledWith(['/auth/select-role']);
    });

    it('debe redirigir a /auth/account-restricted si el estado de la cuenta es SUSPENDED', () => {
      userStore.setProfile({
        id: 'uuid-1',
        email: 'suspended@fixup.com',
        displayName: 'Suspended User',
        status: 'SUSPENDED',
        roles: ['OWNER']
      });

      const guard = roleGuard(['OWNER']);
      const canActivate = TestBed.runInInjectionContext(() => guard(mockRoute, mockState));
      expect(canActivate).toBe(false);
      expect(routerNavigateSpy).toHaveBeenCalledWith(['/auth/account-restricted']);
    });
  });
});
