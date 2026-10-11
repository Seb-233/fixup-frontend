import { LocationFailureReason } from './location.models';

// FR-UC-06: parámetros de entrada de la búsqueda geográfica tal como los captura la UI.
// No es un contrato de la API: los resultados y la petición provendrán del cliente OpenAPI.
export interface PropertySearchParameters {
  latitude: number;
  longitude: number;
  radiusKm: number;
}

/** Estados de la pantalla relacionados únicamente con la adquisición de ubicación. */
export type LocationUiState = 'idle' | 'locating' | 'locationReady' | 'locationError';

export type { LocationFailureReason };

/** Radios de búsqueda ofrecidos en la primera versión, en kilómetros. */
export const RADIUS_OPTIONS_KM: readonly number[] = [1, 3, 5, 10];
export const DEFAULT_RADIUS_KM = 5;
