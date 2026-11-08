import { Role } from '../auth/auth.types';
import { ROLE_PANEL, getNavigationForRole, getNavigationGroupsForRole } from './role-navigation';

const paths = (role: Role, verified = true) => getNavigationForRole(role, verified).map((item) => item.path);

describe('Navegación por rol', () => {
  it('no muestra nada sin rol activo', () => {
    expect(getNavigationForRole(null)).toEqual([]);
  });

  it.each(['OWNER', 'TENANT', 'FIXER', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN'] as const)(
    '%s empieza en Inicio y tiene como máximo cuatro accesos en la barra inferior',
    (role) => {
      const items = getNavigationForRole(role);
      expect(items[0].path).toBe('/dashboard');
      expect(items.filter((item) => item.mobilePrimary).length).toBeLessThanOrEqual(4);
    }
  );

  it.each(['OWNER', 'TENANT', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN'] as const)('%s llega al catálogo de inmuebles (FR-UC-02/06)', (role) => {
    expect(paths(role)).toContain('/catalog');
  });

  it.each(['OWNER', 'TENANT', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN'] as const)('%s llega a los indicadores de mercado (FR-UC-15)', (role) => {
    expect(paths(role)).toContain('/analytics/market-indicators');
  });

  it('Mercado queda en Explorar para la inmobiliaria y en Consulta para el administrador', () => {
    const groupOf = (role: Role) =>
      getNavigationGroupsForRole(role).find((section) =>
        section.items.some((entry) => entry.path === '/analytics/market-indicators')
      )?.label;
    expect(groupOf('REAL_ESTATE_MANAGER')).toBe('Explorar');
    expect(groupOf('PLATFORM_ADMIN')).toBe('Consulta');
  });

  it('solo el propietario ve Remodelaciones (FR-UC-01)', () => {
    expect(paths('OWNER')).toContain('/remodelings');
    for (const role of ['FIXER', 'TENANT', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN'] as const) {
      expect(paths(role)).not.toContain('/remodelings');
    }
  });

  it('quien paga ve Pagos y Gastos; el técnico ve Ingresos', () => {
    expect(paths('OWNER')).toEqual(expect.arrayContaining(['/payments', '/expenses']));
    expect(paths('REAL_ESTATE_MANAGER')).toEqual(expect.arrayContaining(['/payments', '/expenses']));
    expect(paths('FIXER')).toContain('/payments/earnings');
    expect(paths('FIXER')).not.toContain('/payments');
  });

  it('la inmobiliaria tiene su tablero de mantenimiento y la carga masiva', () => {
    expect(paths('REAL_ESTATE_MANAGER')).toEqual(expect.arrayContaining(['/management', '/administration/properties/bulk-upload']));
  });

  it('el administrador revisa técnicos y plazos', () => {
    expect(paths('PLATFORM_ADMIN')).toEqual(expect.arrayContaining(['/administration/fixer-review', '/administration/sla-board']));
  });

  it('un técnico sin verificar ve sus destinos bloqueados apuntando a la verificación', () => {
    const items = getNavigationForRole('FIXER', false);
    const gated = items.filter((item) => item.requiresVerification);
    expect(gated.map((item) => item.label)).toEqual(['Disponibles', 'Portafolio']);
    expect(gated.every((item) => item.path === '/fixers/verification')).toBe(true);
    expect(paths('FIXER', true)).toEqual(expect.arrayContaining(['/requests/inbox', '/fixers/portfolio']));
  });

  it('cada rol que participa en visitas tiene la agenda', () => {
    for (const role of ['OWNER', 'TENANT', 'FIXER', 'REAL_ESTATE_MANAGER'] as const) {
      expect(paths(role)).toContain('/visits');
    }
  });

  it.each(['OWNER', 'TENANT', 'FIXER', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN'] as const)(
    '%s agrupa el menú en secciones con rótulo, cada una con pocos accesos y sin repetir destinos',
    (role) => {
      const groups = getNavigationGroupsForRole(role);
      expect(groups[0]).toEqual({ label: null, items: [expect.objectContaining({ path: '/dashboard' })] });
      for (const section of groups.slice(1)) {
        expect(section.label).toBeTruthy();
        expect(section.items.length).toBeGreaterThan(0);
        expect(section.items.length).toBeLessThanOrEqual(4);
      }
      const all = paths(role);
      expect(new Set(all).size).toBe(all.length);
      expect(ROLE_PANEL[role]).toBeTruthy();
    }
  );

  it('las secciones del técnico sin verificar también llevan a la verificación', () => {
    const trabajo = getNavigationGroupsForRole('FIXER', false).find((section) => section.label === 'Trabajo')!;
    expect(trabajo.items.find((entry) => entry.label === 'Disponibles')?.path).toBe('/fixers/verification');
  });
});
