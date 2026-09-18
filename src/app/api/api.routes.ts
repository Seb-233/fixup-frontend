import { environment } from '../../environments/environment';

// Rutas centralizadas de los endpoints del backend de FixUp
export const API_ROUTES = {
  auth: {
    bootstrap: '/auth/bootstrap',
    me: '/auth/me',
    selectRole: '/auth/select-role',
  },
} as const;

// Construye la URL absoluta del endpoint combinando el origen base y la ruta
export function apiUrl(path: string): string {
  return `${environment.apiOrigin}${path}`;
}
