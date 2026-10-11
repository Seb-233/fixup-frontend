import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  LocationFailureReason,
  LocationRequestOptions,
  LocationResult
} from '../models/location.models';

// Valores por defecto: ubicación aproximada pero rápida (suficiente para buscar por radio en km),
// con un tope de espera para no dejar la pantalla bloqueada y caché corta de 1 minuto.
export const DEFAULT_LOCATION_OPTIONS: LocationRequestOptions = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 60000
};

// FR-UC-06: única puerta de entrada a navigator.geolocation. Funciona igual en navegador, PWA y
// WebView de Capacitor Android (el bridge delega el permiso al sistema operativo).
// Nunca emite error por el canal de RxJS: todo desenlace es un LocationResult.
@Injectable({ providedIn: 'root' })
export class LocationService {
  /** Indica si el entorno ofrece la API de geolocalización. */
  isSupported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.geolocation;
  }

  /** Solicita la posición actual una sola vez y emite un único LocationResult. */
  getCurrentLocation(options: Partial<LocationRequestOptions> = {}): Observable<LocationResult> {
    const config: LocationRequestOptions = { ...DEFAULT_LOCATION_OPTIONS, ...options };

    return new Observable<LocationResult>((subscriber) => {
      if (!this.isSupported()) {
        subscriber.next({ status: 'failure', reason: 'unsupported' });
        subscriber.complete();
        return;
      }

      let cancelled = false;
      const emit = (result: LocationResult): void => {
        if (cancelled) return;
        subscriber.next(result);
        subscriber.complete();
      };

      try {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            emit({
              status: 'success',
              coordinates: {
                latitude,
                longitude,
                ...(Number.isFinite(accuracy) ? { accuracyMeters: accuracy } : {})
              }
            });
          },
          (error) => emit({ status: 'failure', reason: this.toReason(error) }),
          config
        );
      } catch {
        emit({ status: 'failure', reason: 'unsupported' });
      }

      // Si el suscriptor se va, se ignora la respuesta tardía del navegador.
      return () => {
        cancelled = true;
      };
    });
  }

  private toReason(error: GeolocationPositionError): LocationFailureReason {
    switch (error.code) {
      case 1: // PERMISSION_DENIED
        return 'permissionDenied';
      case 3: // TIMEOUT
        return 'timeout';
      case 2: // POSITION_UNAVAILABLE
      default:
        return 'positionUnavailable';
    }
  }
}
