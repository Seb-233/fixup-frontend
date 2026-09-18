// Roles reconocidos por el sistema
export type Role =
  | 'OWNER'
  | 'TENANT'
  | 'FIXER'
  | 'REAL_ESTATE_MANAGER'
  | 'PLATFORM_ADMIN';

// Roles que el usuario puede autoasignarse en el registro inicial según el contrato del backend
export type SelectableRole = 'OWNER' | 'TENANT' | 'FIXER';
export type SelfSelectableRole = SelectableRole;

export const INITIAL_ROLE_OPTIONS: readonly SelectableRole[] = [
  'OWNER',
  'TENANT',
  'FIXER'
] as const;

export interface InitialRoleDetail {
  role: SelectableRole;
  name: string;
  tag: string;
  description: string;
}

export const INITIAL_ROLE_DETAILS: readonly InitialRoleDetail[] = [
  {
    role: 'OWNER',
    name: 'Propietario',
    tag: 'Inmuebles',
    description: 'Propietario que publica inmuebles, crea solicitudes y contrata servicios.'
  },
  {
    role: 'TENANT',
    name: 'Arrendatario',
    tag: 'Hogar',
    description: 'Arrendatario o buscador que consulta inmuebles y reporta solicitudes autorizadas.'
  },
  {
    role: 'FIXER',
    name: 'Técnico / Fixer',
    tag: 'Servicios',
    description: 'Técnico que registra su perfil, cotiza solicitudes y ejecuta trabajos.'
  }
] as const;

// Estados posibles de la cuenta (incluye PENDING para perfiles en verificación como FIXER)
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DISABLED' | 'PENDING';

// Perfil de usuario interno consumido por la aplicación frontend
export interface BackendUserProfile {
  id: string;
  email: string | null;
  displayName: string;
  status: UserStatus;
  roles: Role[];
}

// Solicitud de asignación de rol inicial
export interface RoleRequest {
  role: SelectableRole;
}

// Respuesta de consulta y asignación de roles
export interface RolesResponse {
  roles: Role[];
}

// Respuestas devueltas por los endpoints de autenticación del backend
export interface BootstrapResponse {
  id: string;
  email?: string;
  displayName?: string;
  status: UserStatus;
  roles: Role[];
}

export interface UserResponse {
  id: string;
  email?: string;
  displayName?: string;
  status: UserStatus;
  roles: Role[];
}

// Estructura estándar de error devuelta por el backend
export interface ApiErrorResponse {
  status?: number;
  code?: string;
  message?: string;
  path?: string;
}
