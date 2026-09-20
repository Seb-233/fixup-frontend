import { Route } from '@angular/router';
import { routes } from '../../app.routes';
import { roleGuard } from '../../core/auth/role.guard';

/**
 * FR-UC-20: el dinero del técnico no se comparte.
 *
 * Estas dos pantallas muestran saldo y permiten liberar un pago, así que la restricción de rol
 * es parte del caso y no un detalle de configuración: se fija aquí para que nadie la afloje sin
 * darse cuenta.
 */
describe('rutas privadas de FR-UC-20', () => {
  const privateChildren: Route[] =
    routes.find((route) => route.path === '' && Array.isArray(route.children))?.children ?? [];

  function find(path: string): Route {
    const route = privateChildren.find((child) => child.path === path);
    expect(route).toBeDefined();
    return route as Route;
  }

  it('cuelgan del layout privado y se cargan de forma perezosa', () => {
    for (const path of ['jobs/me', 'payments/earnings']) {
      const route = find(path);
      expect(route.loadComponent).toBeDefined();
      expect(route.component).toBeUndefined();
    }
  });

  it('solo las ve el técnico', () => {
    for (const path of ['jobs/me', 'payments/earnings']) {
      const route = find(path);
      expect(route.canActivate).toContain(roleGuard);
      expect(route.data?.['roles']).toEqual(['FIXER']);
    }
  });
});
