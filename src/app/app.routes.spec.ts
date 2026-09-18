import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { CurrentUserStore } from './core/auth/current-user.store';

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

  it('1. la ruta raíz / debe redirigir canónicamente hacia /dashboard', () => {
    const rootRoute = routes.find((r) => r.path === '');
    expect(rootRoute).toBeDefined();
    expect(rootRoute?.redirectTo).toBe('dashboard');
    expect(rootRoute?.pathMatch).toBe('full');
  });

  it('2. un usuario anónimo que visita / termina en /auth/login con returnUrl conservado', async () => {
    userStore.clear();
    await router.navigateByUrl('/');
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Redirige canónicamente a dashboard, interceptado por authGuard hacia /auth/login?returnUrl=/dashboard
    expect(router.url).toContain('/auth/login');
    expect(router.url).toContain('returnUrl=%2Fdashboard');
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
});
