import { environment } from '../../environments/environment';

// Rutas centralizadas de los endpoints del backend de FixUp
export const API_ROUTES = {
  auth: {
    bootstrap: '/auth/bootstrap',
    me: '/auth/me',
    selectRole: '/auth/select-role',
  },
  // FR-UC-18: solicitudes de reparación
  requests: {
    base: '/requests',
    mine: '/requests/me',
    open: '/requests/open',
    detail: (requestId: string) => `/requests/${requestId}`,
  },
  // FR-UC-18: cotizaciones sobre una solicitud
  quotations: {
    base: '/quotations',
    mine: '/quotations/me',
    forRequest: (requestId: string) => `/quotations/for-request/${requestId}`,
    accept: (quotationId: string) => `/quotations/${quotationId}/accept`,
  },
} as const;

// Construye la URL absoluta del endpoint combinando el origen base y la ruta
export function apiUrl(path: string): string {
  return `${environment.apiOrigin}${path}`;
}
