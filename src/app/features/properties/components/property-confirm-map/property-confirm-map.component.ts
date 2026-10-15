import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  output,
  viewChild
} from '@angular/core';
import * as L from 'leaflet';
import { MAP_TILE_CONFIG } from '../../services/tile-provider.config';

function createDraggablePinIcon(): L.DivIcon {
  const html = `
    <div class="confirm-marker-pin" aria-label="Marcador arrastrable de ubicación">
      <div class="confirm-marker-dot"></div>
      <div class="confirm-marker-handle" title="Arrastra este marcador"></div>
    </div>
  `;
  return L.divIcon({
    className: 'custom-confirm-marker',
    html,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
}

const DEFAULT_CENTER_LAT = 4.60971;
const DEFAULT_CENTER_LNG = -74.08175;

@Component({
  selector: 'app-property-confirm-map',
  standalone: true,
  template: `
    <div class="confirm-map-wrapper">
      <div class="confirm-map-header-bar">
        <button
          type="button"
          id="btn-confirm-use-my-location"
          class="btn-use-location"
          (click)="requestLocation.emit()"
          [disabled]="isLocating() || isReverseGeocoding()"
        >
          <span class="loc-icon" aria-hidden="true">📍</span>
          <span>{{ isLocating() ? 'Obteniendo ubicación…' : 'Usar mi ubicación' }}</span>
        </button>

        @if (isReverseGeocoding()) {
          <div class="reverse-badge" role="status" aria-live="polite">
            <span class="reverse-spinner" aria-hidden="true"></span>
            <span>Actualizando dirección…</span>
          </div>
        }
      </div>

      <div
        #mapContainer
        id="property-confirm-map-container"
        class="confirm-map-container"
        tabindex="0"
        role="region"
        aria-label="Mapa de confirmación de ubicación"
      ></div>

      <div class="confirm-map-footer">
        <span class="drag-hint">
          @if (latitude() !== null && longitude() !== null) {
            💡 Puedes arrastrar el marcador o hacer clic en el mapa para afinar la ubicación exacta del inmueble.
          } @else {
            📍 Haz clic en el mapa o escribe una dirección para ubicar el inmueble.
          }
        </span>
        <span class="map-attribution-text">{{ tileConfig.attribution }}</span>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .confirm-map-wrapper {
      position: relative;
      width: 100%;
      border-radius: var(--fixup-radius-md, 8px);
      overflow: hidden;
      border: 1px solid rgba(154, 148, 141, 0.35);
      background: #f8fafc;
    }

    .confirm-map-header-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      padding: 0.45rem 0.65rem;
      background: #ffffff;
      border-bottom: 1px solid #e2e8f0;
    }

    .btn-use-location {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      background: #ffffff;
      color: #2D2E31;
      border: 1px solid #CEAC78;
      border-radius: 6px;
      padding: 0.32rem 0.75rem;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover:not(:disabled) {
        background: #fdfaf3;
        border-color: #B9975B;
      }

      &:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .loc-icon {
        font-size: 0.9rem;
      }
    }

    .confirm-map-container {
      width: 100%;
      height: 320px;
      background: #e2e8f0;
      outline: none;
      cursor: crosshair;

      &:focus-visible {
        outline: 2px solid var(--fixup-color-primary, #2D2E31);
        outline-offset: -2px;
      }
    }

    .reverse-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      background: rgba(45, 46, 49, 0.92);
      color: #fff;
      padding: 0.3rem 0.65rem;
      border-radius: 9999px;
      font-size: 0.76rem;
      font-weight: 600;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
      margin-left: auto;
    }

    .reverse-spinner {
      width: 12px;
      height: 12px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .confirm-map-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.5rem;
      padding: 0.45rem 0.65rem;
      background: #faf9f6;
      border-top: 1px solid #efece5;
    }

    .drag-hint {
      font-size: 0.76rem;
      color: #4A463F;
      font-weight: 500;
    }

    .map-attribution-text {
      font-size: 0.7rem;
      color: #94a3b8;
      margin-left: auto;
    }

    ::ng-deep {
      .custom-confirm-marker {
        background: transparent;
        border: none;
      }

      .confirm-marker-pin {
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        background: #059669;
        position: absolute;
        transform: rotate(-45deg);
        left: 50%;
        top: 50%;
        margin: -16px 0 0 -16px;
        box-shadow: 0 3px 8px rgba(5, 150, 105, 0.4);
        cursor: grab;
        transition: transform 0.15s ease;

        &:active {
          cursor: grabbing;
          transform: rotate(-45deg) scale(1.15);
        }

        .confirm-marker-dot {
          width: 12px;
          height: 12px;
          margin: 10px 0 0 10px;
          background: #fff;
          position: absolute;
          border-radius: 50%;
        }
      }
    }

    @media (max-width: 640px) {
      .confirm-map-container {
        height: 260px;
      }
    }
  `]
})
export class PropertyConfirmMapComponent implements AfterViewInit {
  readonly tileConfig = inject(MAP_TILE_CONFIG);
  private readonly destroyRef = inject(DestroyRef);

  readonly mapContainerRef = viewChild<ElementRef<HTMLDivElement>>('mapContainer');

  readonly latitude = input<number | null>(null);
  readonly longitude = input<number | null>(null);
  readonly addressLabel = input<string | null>(null);
  readonly isReverseGeocoding = input<boolean>(false);
  readonly isLocating = input<boolean>(false);

  readonly positionChanged = output<{ latitude: number; longitude: number }>();
  readonly requestLocation = output<void>();

  private mapInstance: L.Map | null = null;
  private markerInstance: L.Marker | null = null;
  private isInitialized = false;
  private lastRenderedLat: number | null = null;
  private lastRenderedLng: number | null = null;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.cleanup();
    });

    effect(() => {
      const lat = this.latitude();
      const lng = this.longitude();
      if (this.isInitialized) {
        if (lat != null && lng != null) {
          this.updateMarker(lat, lng);
        } else if (this.markerInstance) {
          this.markerInstance.remove();
          this.markerInstance = null;
          this.lastRenderedLat = null;
          this.lastRenderedLng = null;
        }
      }
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  private initMap(): void {
    const container = this.mapContainerRef()?.nativeElement;
    if (!container) return;

    const lat = this.latitude() ?? DEFAULT_CENTER_LAT;
    const lng = this.longitude() ?? DEFAULT_CENTER_LNG;
    const zoom = this.latitude() != null && this.longitude() != null ? 16 : 13;

    try {
      this.mapInstance = L.map(container, {
        center: [lat, lng],
        zoom,
        zoomControl: true,
        attributionControl: false
      });

      L.tileLayer(this.tileConfig.tileUrl, {
        maxZoom: this.tileConfig.maxZoom ?? 19,
        attribution: this.tileConfig.attribution
      }).addTo(this.mapInstance);

      if (this.latitude() != null && this.longitude() != null) {
        this.createMarker(this.latitude()!, this.longitude()!);
      }

      this.mapInstance.on('click', (e: L.LeafletMouseEvent) => {
        this.onMapClick(e.latlng);
      });

      this.isInitialized = true;
    } catch {
      // Degraded fallback handled silently or container stays blank
    }
  }

  private onMapClick(latLng: L.LatLng): void {
    this.updateMarker(latLng.lat, latLng.lng);
    this.positionChanged.emit({ latitude: latLng.lat, longitude: latLng.lng });
  }

  private createMarker(lat: number, lng: number): void {
    if (!this.mapInstance) return;

    if (this.markerInstance) {
      this.markerInstance.remove();
    }

    this.lastRenderedLat = lat;
    this.lastRenderedLng = lng;

    this.markerInstance = L.marker([lat, lng], {
      draggable: true,
      icon: createDraggablePinIcon(),
      title: 'Ubicación de la propiedad (arrastra para ajustar)'
    }).addTo(this.mapInstance);

    this.markerInstance.on('dragend', () => {
      if (!this.markerInstance) return;
      const latLng = this.markerInstance.getLatLng();
      this.lastRenderedLat = latLng.lat;
      this.lastRenderedLng = latLng.lng;
      this.positionChanged.emit({ latitude: latLng.lat, longitude: latLng.lng });
    });

    this.mapInstance.setView([lat, lng], 16);
  }

  private updateMarker(lat: number, lng: number): void {
    if (!this.mapInstance) return;

    if (!this.markerInstance) {
      this.createMarker(lat, lng);
      return;
    }

    if (
      this.lastRenderedLat == null ||
      this.lastRenderedLng == null ||
      Math.abs(this.lastRenderedLat - lat) > 0.00001 ||
      Math.abs(this.lastRenderedLng - lng) > 0.00001
    ) {
      this.lastRenderedLat = lat;
      this.lastRenderedLng = lng;
      this.markerInstance.setLatLng([lat, lng]);
      this.mapInstance.panTo([lat, lng]);
    }
  }

  private cleanup(): void {
    if (this.markerInstance) {
      this.markerInstance.remove();
      this.markerInstance = null;
    }
    if (this.mapInstance) {
      this.mapInstance.remove();
      this.mapInstance = null;
    }
    this.isInitialized = false;
  }
}
