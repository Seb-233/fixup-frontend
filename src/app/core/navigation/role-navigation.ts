import { Role } from '../auth/auth.types';

export interface RoleNavigationItem {
  path: string;
  label: string;
  /** Versión corta para la barra inferior del móvil, donde cada acceso mide un quinto del ancho. */
  shortLabel?: string;
  icon: string;
  /** Aparece en la barra inferior del móvil (máximo cuatro por rol). */
  mobilePrimary: boolean;
  /** Para técnicos aún sin verificar: el destino real queda detrás de la verificación. */
  requiresVerification?: boolean;
}

export interface RoleNavigationGroup {
  /** Rótulo de la sección en el menú; null para el acceso suelto de arriba (Inicio). */
  label: string | null;
  items: readonly RoleNavigationItem[];
}

const item = (path: string, label: string, icon: string, mobilePrimary = false, shortLabel?: string): RoleNavigationItem => ({
  path,
  label,
  shortLabel,
  icon,
  mobilePrimary
});

const group = (label: string | null, ...items: RoleNavigationItem[]): RoleNavigationGroup => ({ label, items });

const HOME = item('/dashboard', 'Inicio', 'home', true);

// Cada rol ve solo los destinos de su trabajo, agrupados por lo que la persona quiere resolver, no
// por módulo del sistema. Notificaciones y perfil viven en la barra superior, así que no se repiten.
const ROLE_NAVIGATION: Record<Role, readonly RoleNavigationGroup[]> = {
  OWNER: [
    group(null, HOME),
    group(
      'Mis inmuebles',
      item('/properties', 'Inmuebles', 'building', true),
      item('/contracts', 'Contratos', 'file'),
      item('/remodelings', 'Remodelaciones', 'hammer')
    ),
    group(
      'Reparaciones',
      item('/requests', 'Solicitudes', 'wrench', true),
      item('/visits', 'Agenda', 'calendar', true),
      item('/fixers', 'Técnicos', 'users')
    ),
    group('Dinero', item('/payments', 'Pagos', 'card'), item('/expenses', 'Gastos', 'chart')),
    group('Explorar', item('/catalog', 'Catálogo', 'search'), item('/analytics/market-indicators', 'Mercado', 'map'))
  ],
  TENANT: [
    group(null, HOME),
    group(
      'Mi arriendo',
      item('/contracts', 'Mi contrato', 'file', true, 'Contrato'),
      item('/requests', 'Solicitudes', 'wrench', true),
      item('/visits', 'Agenda', 'calendar')
    ),
    group(
      'Explorar',
      item('/catalog', 'Catálogo', 'search', true),
      item('/fixers', 'Técnicos', 'users'),
      item('/analytics/market-indicators', 'Mercado', 'map')
    )
  ],
  FIXER: [
    group(null, HOME),
    group(
      'Trabajo',
      item('/requests/inbox', 'Disponibles', 'clipboard', true),
      item('/quotations/me', 'Cotizaciones', 'file'),
      item('/jobs/me', 'Trabajos', 'wrench', true),
      item('/visits', 'Agenda', 'calendar', true)
    ),
    group(
      'Mi negocio',
      item('/payments/earnings', 'Ingresos', 'wallet'),
      item('/fixers/portfolio', 'Portafolio', 'image'),
      item('/fixers/verification', 'Verificación', 'shield')
    )
  ],
  REAL_ESTATE_MANAGER: [
    group(null, HOME),
    group(
      'Operación',
      item('/management', 'Mantenimiento', 'clipboard', true, 'Tablero'),
      item('/requests', 'Solicitudes', 'wrench', true),
      item('/visits', 'Agenda', 'calendar')
    ),
    group(
      'Cartera',
      item('/properties', 'Inmuebles', 'building', true),
      item('/contracts', 'Contratos', 'file'),
      item('/administration/properties/bulk-upload', 'Carga masiva', 'upload')
    ),
    group('Dinero', item('/payments', 'Pagos', 'card'), item('/expenses', 'Gastos', 'chart')),
    group(
      'Explorar',
      item('/catalog', 'Catálogo', 'search'),
      item('/fixers', 'Técnicos', 'users'),
      item('/analytics/market-indicators', 'Mercado', 'map')
    )
  ],
  PLATFORM_ADMIN: [
    group(null, HOME),
    group(
      'Supervisión',
      item('/administration/sla-board', 'Plazos', 'clock', true),
      item('/administration/fixer-review', 'Verificaciones', 'shield', true, 'Revisión')
    ),
    group(
      'Datos',
      item('/administration/properties/bulk-upload', 'Carga masiva', 'upload', true, 'Carga'),
      item('/contracts', 'Contratos', 'file')
    ),
    group(
      'Consulta',
      item('/catalog', 'Catálogo', 'search'),
      item('/fixers', 'Técnicos', 'users'),
      item('/analytics/market-indicators', 'Mercado', 'map')
    )
  ]
};

/** Nombre del panel que se muestra en el marco, para que cada rol sepa dónde está. */
export const ROLE_PANEL: Record<Role, string> = {
  OWNER: 'Panel de propietario',
  TENANT: 'Panel de arrendatario',
  FIXER: 'Panel de técnico',
  REAL_ESTATE_MANAGER: 'Panel de inmobiliaria',
  PLATFORM_ADMIN: 'Administración'
};

const GATED_FOR_UNVERIFIED = new Set(['/requests/inbox', '/fixers/portfolio']);

export function getNavigationGroupsForRole(role: Role | null, fixerVerified = true): readonly RoleNavigationGroup[] {
  if (!role) return [];
  const groups = ROLE_NAVIGATION[role];
  if (role !== 'FIXER' || fixerVerified) return groups;
  return groups.map((section) => ({
    ...section,
    items: section.items.map((entry) =>
      GATED_FOR_UNVERIFIED.has(entry.path)
        ? { ...entry, path: '/fixers/verification', requiresVerification: true }
        : entry
    )
  }));
}

export function getNavigationForRole(role: Role | null, fixerVerified = true): readonly RoleNavigationItem[] {
  return getNavigationGroupsForRole(role, fixerVerified).flatMap((section) => section.items);
}
