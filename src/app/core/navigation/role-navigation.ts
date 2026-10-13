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

const item = (path: string, label: string, icon: string, mobilePrimary = false, shortLabel?: string): RoleNavigationItem => ({
  path,
  label,
  shortLabel,
  icon,
  mobilePrimary
});

// Cada rol ve solo los destinos de su trabajo, en el orden en que los usa. Notificaciones y perfil
// viven en la barra superior, así que no se repiten aquí.
const ROLE_NAVIGATION: Record<Role, readonly RoleNavigationItem[]> = {
  OWNER: [
    item('/dashboard', 'Inicio', 'home', true),
    item('/properties', 'Mis inmuebles', 'building', true, 'Inmuebles'),
    item('/requests', 'Solicitudes', 'wrench', true),
    item('/visits', 'Agenda', 'calendar', true),
    item('/payments', 'Pagos', 'card'),
    item('/expenses', 'Gastos', 'chart'),
    item('/contracts', 'Contratos', 'file'),
    item('/remodelings', 'Remodelaciones', 'hammer'),
    item('/catalog', 'Catálogo', 'search'),
    item('/fixers', 'Técnicos', 'users'),
    item('/analytics/market-indicators', 'Mercado', 'map')
  ],
  TENANT: [
    item('/dashboard', 'Inicio', 'home', true),
    item('/catalog', 'Catálogo', 'search', true),
    item('/requests', 'Solicitudes', 'wrench', true),
    item('/contracts', 'Mi contrato', 'file', true),
    item('/visits', 'Agenda', 'calendar'),
    item('/fixers', 'Técnicos', 'users'),
    item('/analytics/market-indicators', 'Mercado', 'map')
  ],
  FIXER: [
    item('/dashboard', 'Inicio', 'home', true),
    item('/requests/inbox', 'Disponibles', 'clipboard', true),
    item('/jobs/me', 'Trabajos', 'wrench', true),
    item('/visits', 'Agenda', 'calendar', true),
    item('/quotations/me', 'Cotizaciones', 'file'),
    item('/payments/earnings', 'Ingresos', 'wallet'),
    item('/fixers/portfolio', 'Portafolio', 'image'),
    item('/fixers/verification', 'Verificación', 'shield')
  ],
  REAL_ESTATE_MANAGER: [
    item('/dashboard', 'Inicio', 'home', true),
    item('/management', 'Mantenimiento', 'clipboard', true, 'Tablero'),
    item('/properties', 'Inmuebles', 'building', true),
    item('/requests', 'Solicitudes', 'wrench', true),
    item('/visits', 'Agenda', 'calendar'),
    item('/payments', 'Pagos', 'card'),
    item('/expenses', 'Gastos', 'chart'),
    item('/contracts', 'Contratos', 'file'),
    item('/administration/properties/bulk-upload', 'Carga masiva', 'upload'),
    item('/catalog', 'Catálogo', 'search'),
    item('/fixers', 'Técnicos', 'users')
  ],
  PLATFORM_ADMIN: [
    item('/dashboard', 'Inicio', 'home', true),
    item('/administration/sla-board', 'Plazos', 'clock', true),
    item('/administration/fixer-review', 'Verificaciones', 'shield', true, 'Revisión'),
    item('/administration/properties/bulk-upload', 'Carga masiva', 'upload', true, 'Carga'),
    item('/contracts', 'Contratos', 'file'),
    item('/catalog', 'Catálogo', 'search'),
    item('/fixers', 'Técnicos', 'users')
  ]
};

const GATED_FOR_UNVERIFIED = new Set(['/requests/inbox', '/fixers/portfolio']);

export function getNavigationForRole(role: Role | null, fixerVerified = true): readonly RoleNavigationItem[] {
  if (!role) return [];
  const items = ROLE_NAVIGATION[role];
  if (role !== 'FIXER' || fixerVerified) return items;
  return items.map((entry) =>
    GATED_FOR_UNVERIFIED.has(entry.path)
      ? { ...entry, path: '/fixers/verification', requiresVerification: true }
      : entry
  );
}
