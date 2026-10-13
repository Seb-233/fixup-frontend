import { getNavigationForRole } from './role-navigation';

describe('Navegación por rol: Explorar inmuebles (FR-UC-06)', () => {
  const explore = (role: Parameters<typeof getNavigationForRole>[0]) =>
    getNavigationForRole(role).find((item) => item.path === '/properties/search');

  it.each(['OWNER', 'TENANT'] as const)('%s tiene "Explorar inmuebles"', (role) => {
    expect(explore(role)?.label).toBe('Explorar inmuebles');
  });

  it.each(['FIXER', 'REAL_ESTATE_MANAGER'] as const)('%s no tiene "Explorar inmuebles"', (role) => {
    expect(explore(role)).toBeUndefined();
  });

  it('OWNER conserva "Mis propiedades" separado de "Explorar inmuebles"', () => {
    const items = getNavigationForRole('OWNER');
    const mine = items.find((item) => item.path === '/properties');

    expect(mine?.label).toBe('Mis propiedades');
    expect(items.filter((item) => item.path === '/properties/search')).toHaveLength(1);
  });
});
