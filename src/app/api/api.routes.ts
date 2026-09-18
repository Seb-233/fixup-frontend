import { environment } from '../../environments/environment';

// Rutas centralizadas de los endpoints del backend de FixUp
export const API_ROUTES = {
  auth: {
    bootstrap: '/auth/bootstrap',
    me: '/auth/me',
    selectRole: '/auth/select-role',
  },
  // Prefijos de los casos de uso que exigen token. El cliente concreto de cada operación es
  // generado desde docs/openapi.json; aquí solo vive lo que necesita el interceptor de Auth0.
  authenticatedPrefixes: ['/auth/', '/fixers/', '/media/', '/analytics/'],
} as const;

// Construye la URL absoluta del endpoint combinando el origen base y la ruta
export function apiUrl(path: string): string {
  return `${environment.apiOrigin}${path}`;
}

// Indica si una URL apunta a un endpoint protegido del backend de FixUp.
// Se compara contra el origen configurado para no adjuntar el token a terceros.
export function isFixUpApiUrl(url: string): boolean {
  if (!url.startsWith(environment.apiOrigin)) {
    return false;
  }
  const path = url.slice(environment.apiOrigin.length);
  return API_ROUTES.authenticatedPrefixes.some((prefix) => path.startsWith(prefix));
}
