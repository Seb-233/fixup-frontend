import { LocationFailureReason } from './location.models';

// FR-UC-06: parámetros de entrada de la búsqueda geográfica tal como los captura la UI.
// No es un contrato de la API: los resultados y la petición provendrán del cliente OpenAPI.
export interface PropertySearchParameters {
  latitude: number;
  longitude: number;
  radiusKm: number;
  /** Solo se informa para OWNER; TENANT siempre explora "todos". */
  ownership?: OwnershipFilter;
}

/** Estados de la pantalla relacionados con la obtención de la ubicación de referencia. */
export type LocationUiState =
  | 'idle'
  | 'locating'
  | 'locationReady'
  | 'locationError'
  /** Dirección escrita que todavía no se ha convertido en coordenadas. */
  | 'addressPending';

export type { LocationFailureReason };

/** Origen de la ubicación de referencia: GPS del dispositivo o dirección escrita. */
export type LocationSource = 'gps' | 'address';

/**
 * Qué inmuebles muestra la exploración (solo OWNER). Se mapeará al ownershipScope del backend
 * cuando exista el contrato OpenAPI.
 */
export type OwnershipFilter = 'ALL' | 'MINE' | 'OTHERS';

export const OWNERSHIP_OPTIONS: readonly { value: OwnershipFilter; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'MINE', label: 'Mis inmuebles' },
  { value: 'OTHERS', label: 'Otros inmuebles' }
];

/** Valores que captura el formulario de filtros (sin coordenadas: las aporta la página). */
export interface PropertySearchFormValue {
  addressQuery: string;
  radiusKm: number;
  ownership: OwnershipFilter;
}

/** Radios de búsqueda ofrecidos en la primera versión, en kilómetros. */
export const RADIUS_OPTIONS_KM: readonly number[] = [1, 3, 5, 10];
export const DEFAULT_RADIUS_KM = 5;
