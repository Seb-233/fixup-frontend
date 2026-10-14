import { Role } from '../auth/auth.types';
import { getNavigationForRole } from './role-navigation';

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
});
