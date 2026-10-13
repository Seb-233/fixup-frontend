import { InjectionToken } from '@angular/core';
import { environment } from '../../../../environments/environment';

export interface MapTileConfig {
  tileUrl: string;
  attribution: string;
  maxZoom?: number;
  minZoom?: number;
  /** Permite simular fallos de inicialización en pruebas sin alterar dependencias globales */
  simulateFailure?: boolean;
}

export const MAP_TILE_CONFIG = new InjectionToken<MapTileConfig>('MAP_TILE_CONFIG', {
  providedIn: 'root',
  factory: () =>
    environment.map ?? {
      tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }
});
