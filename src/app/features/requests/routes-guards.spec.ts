import { routes } from '../../app.routes';
import { roleGuard } from '../../core/auth/role.guard';

describe('Guards de rutas FR-UC-18 (Requests y Quotations)', () => {
  // Las rutas privadas residen como hijas de PrivateShellComponent
  const privateRoute = routes.find((r) => r.children && r.canActivate);
  const children = privateRoute?.children ?? [];

  it('1. /requests debe estar protegida por roleGuard para OWNER, TENANT, REAL_ESTATE_MANAGER', () => {
    const route = children.find((c) => c.path === 'requests');
    expect(route).toBeDefined();
    expect(route?.canActivate).toContain(roleGuard);
    expect(route?.data?.['roles']).toEqual(['OWNER', 'TENANT', 'REAL_ESTATE_MANAGER']);
  });

  it('2. /requests/inbox debe estar protegida por roleGuard exclusivamente para FIXER', () => {
    const route = children.find((c) => c.path === 'requests/inbox');
    expect(route).toBeDefined();
    expect(route?.canActivate).toContain(roleGuard);
    expect(route?.data?.['roles']).toEqual(['FIXER']);
  });

  it('3. /requests/:requestId debe estar protegida para OWNER, TENANT, FIXER, REAL_ESTATE_MANAGER, PLATFORM_ADMIN', () => {
    const route = children.find((c) => c.path === 'requests/:requestId');
    expect(route).toBeDefined();
    expect(route?.canActivate).toContain(roleGuard);
    expect(route?.data?.['roles']).toEqual([
      'OWNER',
      'TENANT',
      'FIXER',
      'REAL_ESTATE_MANAGER',
      'PLATFORM_ADMIN'
    ]);
  });

  it('4. /quotations/me debe estar protegida por roleGuard exclusivamente para FIXER', () => {
    const route = children.find((c) => c.path === 'quotations/me');
    expect(route).toBeDefined();
    expect(route?.canActivate).toContain(roleGuard);
    expect(route?.data?.['roles']).toEqual(['FIXER']);
  });

  it('5. /quotations/request/:requestId debe estar protegida para OWNER, TENANT, REAL_ESTATE_MANAGER', () => {
    const route = children.find((c) => c.path === 'quotations/request/:requestId');
    expect(route).toBeDefined();
    expect(route?.canActivate).toContain(roleGuard);
    expect(route?.data?.['roles']).toEqual(['OWNER', 'TENANT', 'REAL_ESTATE_MANAGER']);
  });

  it('6. la ruta requests/inbox debe declararse antes de requests/:requestId para evitar colisión de enrutamiento', () => {
    const inboxIndex = children.findIndex((c) => c.path === 'requests/inbox');
    const detailIndex = children.findIndex((c) => c.path === 'requests/:requestId');
    expect(inboxIndex).toBeGreaterThan(-1);
    expect(detailIndex).toBeGreaterThan(-1);
    expect(inboxIndex).toBeLessThan(detailIndex);
  });
});
