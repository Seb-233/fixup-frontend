import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { CurrentUserStore } from './core/auth/current-user.store';
import { roleGuard } from './core/auth/role.guard';

describe('Enrutamiento y Separación de Layouts (Requerimientos 1, 2 y 3)', () => {
  let router: Router;
  let userStore: CurrentUserStore;

  const mockAuthService = {
    isLoading$: of(false),
    sessionReady$: of(null)
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideLocationMocks(),
        CurrentUserStore,
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    userStore = TestBed.inject(CurrentUserStore);
  });

  it('1. la ruta raíz / carga la landing pública y no redirige al dashboard', async () => {
    const rootRoute = routes.find((r) => r.path === '');
    expect(rootRoute).toBeDefined();
    expect(rootRoute?.redirectTo).toBeUndefined();
    expect(rootRoute?.pathMatch).toBe('full');
    expect(rootRoute?.loadComponent).toBeDefined();

    const component = await rootRoute?.loadComponent?.();
    expect(component).toBeDefined();
    expect((component as { ɵcmp?: { selectors?: string[][] } }).ɵcmp?.selectors).toContainEqual([
      'app-landing-page'
    ]);
  });

  it('2. / es pública y queda fuera de PrivateShell', async () => {
    userStore.clear();
    await router.navigateByUrl('/');
    expect(router.url).toBe('/');

    const privateLayoutRoute = routes.find((route) => route.component && route.children);
    expect(privateLayoutRoute?.children?.some((child) => child.path === '')).toBe(false);
  });

  it('3. las rutas públicas /auth/login y /auth/callback deben estar fuera del layout privado', () => {
    const loginRoute = routes.find((r) => r.path === 'auth/login');
    const callbackRoute = routes.find((r) => r.path === 'auth/callback');

    expect(loginRoute).toBeDefined();
    expect(callbackRoute).toBeDefined();

    // Comprobar que no son hijos de PrivateShellComponent
    const privateLayoutRoute = routes.find((r) => r.children && r.canActivate);
    const privateChildren = privateLayoutRoute?.children ?? [];

    expect(privateChildren.some((child) => child.path === 'auth/login')).toBe(false);
    expect(privateChildren.some((child) => child.path === 'auth/callback')).toBe(false);
  });

  it('4. /properties carga de forma diferida la pantalla de propietarios e inmobiliarias', () => {
    const privateLayoutRoute = routes.find((route) => route.children && route.canActivate);
    const propertiesRoute = privateLayoutRoute?.children?.find((route) => route.path === 'properties');

    expect(propertiesRoute).toBeDefined();
    expect(propertiesRoute?.loadComponent).toBeDefined();
    expect(propertiesRoute?.component).toBeUndefined();
    expect(propertiesRoute?.data?.['roles']).toEqual(['OWNER', 'REAL_ESTATE_MANAGER']);
  });

  it('5. /dashboard sigue dentro del shell privado autenticado y exige un rol activo', () => {
    const privateLayoutRoute = routes.find((route) => route.component && route.children);
    const dashboardRoute = privateLayoutRoute?.children?.find((route) => route.path === 'dashboard');

    expect(privateLayoutRoute?.canActivate).toBeDefined();
    expect(dashboardRoute?.loadComponent).toBeDefined();
    // El guard de rol cubre a todas las rutas hijas del shell privado.
    expect(privateLayoutRoute?.canActivateChild).toContain(roleGuard);
    expect(dashboardRoute?.data?.['roles']).toBeUndefined();
  });

  it('6. /remodelings y /remodelings/new exigen rol OWNER y cargan de forma diferida', () => {
    const privateLayoutRoute = routes.find((route) => route.children && route.canActivate);
    const listRoute = privateLayoutRoute?.children?.find((route) => route.path === 'remodelings');
    const newRoute = privateLayoutRoute?.children?.find((route) => route.path === 'remodelings/new');

    expect(listRoute).toBeDefined();
    expect(listRoute?.loadComponent).toBeDefined();
    expect(listRoute?.data?.['roles']).toEqual(['OWNER']);

    expect(newRoute).toBeDefined();
    expect(newRoute?.loadComponent).toBeDefined();
    expect(newRoute?.data?.['roles']).toEqual(['OWNER']);
  });

  it('7. /remodelings/:projectId permite OWNER y PLATFORM_ADMIN para soporte de solo lectura', () => {
    const privateLayoutRoute = routes.find((route) => route.children && route.canActivate);
    const detailRoute = privateLayoutRoute?.children?.find((route) => route.path === 'remodelings/:projectId');

    expect(detailRoute).toBeDefined();
    expect(detailRoute?.loadComponent).toBeDefined();
    expect(detailRoute?.data?.['roles']).toEqual(['OWNER', 'PLATFORM_ADMIN']);
  });

  it('8. los enlaces de notificaciones del backend tienen destino', () => {
    const privateLayoutRoute = routes.find((route) => route.component && route.children);
    const childPaths = privateLayoutRoute?.children?.map((route) => route.path) ?? [];
    for (const path of [
      'properties/:propertyId',
      'visits/:visitId',
      'management/requests',
      'fixers/:fixerUserId/profile',
      'quotations/request/:requestId',
      'requests/:requestId/messages',
      'jobs/me',
      'payments/earnings',
      'fixers/verification',
      'contracts/:contractId'
    ]) {
      expect(childPaths).toContain(path);
    }
  });

  it('9. /payments y /payments/:paymentId restringen acceso a roles pagadores (OWNER, REAL_ESTATE_MANAGER)', () => {
    const privateLayoutRoute = routes.find((route) => route.children && route.canActivate);
    const paymentsRoute = privateLayoutRoute?.children?.find((route) => route.path === 'payments');
    const checkoutRoute = privateLayoutRoute?.children?.find((route) => route.path === 'payments/:paymentId');

    expect(paymentsRoute).toBeDefined();
    expect(paymentsRoute?.data?.['roles']).toEqual(['OWNER', 'REAL_ESTATE_MANAGER']);
    expect(checkoutRoute).toBeDefined();
    expect(checkoutRoute?.data?.['roles']).toEqual(['OWNER', 'REAL_ESTATE_MANAGER']);
  });

  it('10. /payments/earnings restringe a FIXER y /expenses a pagadores', () => {
    const privateLayoutRoute = routes.find((route) => route.children && route.canActivate);
    const earningsRoute = privateLayoutRoute?.children?.find((route) => route.path === 'payments/earnings');
    const expensesRoute = privateLayoutRoute?.children?.find((route) => route.path === 'expenses');

    expect(earningsRoute).toBeDefined();
    expect(earningsRoute?.data?.['roles']).toEqual(['FIXER']);
    expect(expensesRoute).toBeDefined();
    expect(expensesRoute?.data?.['roles']).toEqual(['OWNER', 'REAL_ESTATE_MANAGER']);
  });
});
