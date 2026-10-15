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

@Component({
  selector: 'app-property-confirm-map',
  standalone: true,
  template: `
    <div class="confirm-map-wrapper">
      <div
        #mapContainer
        id="property-confirm-map-container"
        class="confirm-map-container"
        tabindex="0"
        role="region"
        aria-label="Mapa de confirmación de ubicación"
      ></div>

      @if (isReverseGeocoding()) {
        <div class="reverse-badge" role="status" aria-live="polite">
          <span class="reverse-spinner" aria-hidden="true"></span>
          <span>Actualizando dirección…</span>
        </div>
      }

      <div class="confirm-map-footer">
        <span class="drag-hint">💡 Puedes arrastrar el marcador para afinar la ubicación exacta del inmueble.</span>
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

    .confirm-map-container {
      width: 100%;
      height: 320px;
      background: #e2e8f0;
      outline: none;

      &:focus-visible {
        outline: 2px solid var(--fixup-color-primary, #2D2E31);
        outline-offset: -2px;
      }
    }

    .reverse-badge {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 1000;
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      background: rgba(45, 46, 49, 0.92);
      color: #fff;
      padding: 0.35rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.78rem;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
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

  readonly positionChanged = output<{ latitude: number; longitude: number }>();

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
      if (lat != null && lng != null && this.isInitialized) {
        this.updateMarker(lat, lng);
      }
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  private initMap(): void {
    const container = this.mapContainerRef()?.nativeElement;
    if (!container) return;

    const lat = this.latitude() ?? 4.6097;
    const lng = this.longitude() ?? -74.0817;

    try {
      this.mapInstance = L.map(container, {
        center: [lat, lng],
        zoom: 16,
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

      this.isInitialized = true;
    } catch {
      // Degraded fallback handled silently or container stays blank
    }
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

    // Only update if coordinates differ significantly (to avoid jumping on minor drag events)
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
