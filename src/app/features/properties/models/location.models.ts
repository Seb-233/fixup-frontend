// FR-UC-06: modelos internos de adquisición de ubicación del dispositivo.
// No representan ningún contrato de la API de propiedades.

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  /** Precisión horizontal estimada en metros, si el dispositivo la informa. */
  accuracyMeters?: number;
}

/** Motivos por los que no se pudo obtener la ubicación. */
export type LocationFailureReason =
  | 'permissionDenied'
  | 'positionUnavailable'
  | 'timeout'
  | 'unsupported';

export type LocationResult =
  | { status: 'success'; coordinates: LocationCoordinates }
  | { status: 'failure'; reason: LocationFailureReason };

export interface LocationRequestOptions {
  enableHighAccuracy: boolean;
  /** Tiempo máximo de espera en milisegundos. */
  timeout: number;
  /** Antigüedad máxima aceptable de una posición en caché, en milisegundos. */
  maximumAge: number;
}
