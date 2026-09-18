// Roles reconocidos por el sistema
export type Role =
  | 'OWNER'
  | 'TENANT'
  | 'FIXER'
  | 'REAL_ESTATE_MANAGER'
  | 'PLATFORM_ADMIN';

// Roles que el usuario puede autoasignarse en el registro inicial
export type SelfSelectableRole = 'OWNER' | 'TENANT' | 'FIXER';

// Estados posibles de la cuenta
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DISABLED';

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
  role: SelfSelectableRole;
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
