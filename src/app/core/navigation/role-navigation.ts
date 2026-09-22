import { Role } from '../auth/auth.types';

export type NavigationIcon =
  | 'dashboard'
  | 'properties'
  | 'requests'
  | 'quotations'
  | 'jobs'
  | 'earnings'
  | 'verification'
  | 'portfolio'
  | 'review'
  | 'profile';

export interface RoleNavigationItem {
  path: string;
  label: string;
  icon: NavigationIcon;
  mobilePrimary: boolean;
}

const ROLE_NAVIGATION: Record<Role, readonly RoleNavigationItem[]> = {
  OWNER: [
    { path: '/dashboard', label: 'Panel Principal', icon: 'dashboard', mobilePrimary: true },
    { path: '/properties', label: 'Mis propiedades', icon: 'properties', mobilePrimary: true },
    { path: '/requests', label: 'Mis solicitudes', icon: 'requests', mobilePrimary: true },
    { path: '/profile', label: 'Mi perfil', icon: 'profile', mobilePrimary: true }
  ],
  FIXER: [
    { path: '/dashboard', label: 'Panel Principal', icon: 'dashboard', mobilePrimary: true },
    { path: '/requests/inbox', label: 'Solicitudes disponibles', icon: 'requests', mobilePrimary: true },
    { path: '/quotations/me', label: 'Mis cotizaciones', icon: 'quotations', mobilePrimary: false },
    { path: '/jobs/me', label: 'Mis trabajos', icon: 'jobs', mobilePrimary: true },
    { path: '/payments/earnings', label: 'Mis ingresos', icon: 'earnings', mobilePrimary: false },
    { path: '/fixers/verification', label: 'Verificación', icon: 'verification', mobilePrimary: false },
    { path: '/fixers/portfolio', label: 'Mi portafolio', icon: 'portfolio', mobilePrimary: false },
    { path: '/profile', label: 'Mi perfil', icon: 'profile', mobilePrimary: true }
  ],
  PLATFORM_ADMIN: [
    { path: '/dashboard', label: 'Panel Principal', icon: 'dashboard', mobilePrimary: true },
    { path: '/administration/fixer-review', label: 'Revisión de técnicos', icon: 'review', mobilePrimary: true },
    { path: '/profile', label: 'Mi perfil', icon: 'profile', mobilePrimary: true }
  ],
  TENANT: [
    { path: '/dashboard', label: 'Panel Principal', icon: 'dashboard', mobilePrimary: true },
    { path: '/requests', label: 'Mis solicitudes', icon: 'requests', mobilePrimary: true },
    { path: '/profile', label: 'Mi perfil', icon: 'profile', mobilePrimary: true }
  ],
  REAL_ESTATE_MANAGER: [
    { path: '/dashboard', label: 'Panel Principal', icon: 'dashboard', mobilePrimary: true },
    { path: '/requests', label: 'Mis solicitudes', icon: 'requests', mobilePrimary: true },
    { path: '/profile', label: 'Mi perfil', icon: 'profile', mobilePrimary: true }
  ]
};

export function getNavigationForRole(role: Role | null): readonly RoleNavigationItem[] {
  return role ? ROLE_NAVIGATION[role] : [];
}
