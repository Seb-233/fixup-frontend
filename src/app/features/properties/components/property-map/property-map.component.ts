import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import * as L from 'leaflet';
import { PropertySearchResult } from '../../../../api/generated';
import { LocationCoordinates } from '../../models/location.models';
import { MAP_TILE_CONFIG } from '../../services/tile-provider.config';

function formatDistance(distanceKm: number): string {
  if (distanceKm < 1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

function createPropertyMarkerIcon(isSelected: boolean, isMine: boolean): L.DivIcon {
  const selectedClass = isSelected ? ' marker-selected' : '';
  const mineClass = isMine ? ' marker-mine' : '';
  const html = `<div class="marker-pin${selectedClass}${mineClass}"><div class="marker-dot"></div></div>`;
  return L.divIcon({
    className: 'custom-property-marker',
    html,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28]
  });
}

function createCenterMarkerIcon(): L.DivIcon {
  const html = `<div class="center-pin"><div class="center-pulse"></div><div class="center-dot"></div></div>`;
  return L.divIcon({
    className: 'custom-center-marker',
    html,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
}

@Component({
  selector: 'app-property-map',
  standalone: true,
  template: `
    @if (isUnavailable()) {
      <div id="map-degraded-state" class="map-degraded-alert" role="status">
        <p class="degraded-title">El mapa no está disponible temporalmente.</p>
        <p class="degraded-hint">Puedes consultar los inmuebles en la lista.</p>
      </div>
    } @else {
      <div class="map-wrapper">
        <div
          #mapContainer
          id="property-map-container"
          class="map-container"
          tabindex="0"
          role="region"
          aria-label="Mapa de inmuebles cercanos"
        ></div>
        <p id="map-attribution" class="map-attribution-text">
          {{ tileConfig.attribution }}
        </p>
      </div>
    }
  `,
  styleUrls: ['./property-map.component.scss']
})
export class PropertyMapComponent implements AfterViewInit {
  readonly tileConfig = inject(MAP_TILE_CONFIG);
  private readonly destroyRef = inject(DestroyRef);

  readonly mapContainerRef = viewChild<ElementRef<HTMLDivElement>>('mapContainer');

  readonly results = input<PropertySearchResult[]>([]);
  readonly searchCenter = input<LocationCoordinates | null>(null);
  readonly radiusKm = input<number>(5);
  readonly selectedPropertyId = input<string | null>(null);

  readonly propertySelected = output<PropertySearchResult>();
  readonly mapUnavailable = output<boolean>();

  readonly isUnavailable = signal<boolean>(false);

  private mapInstance: L.Map | null = null;
  private centerMarker: L.Marker | null = null;
  private radiusCircle: L.Circle | null = null;
  private readonly markersMap = new Map<string, L.Marker>();
  private resizeObserver: ResizeObserver | null = null;
  private tileErrorCount = 0;
  private isInitialized = false;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.cleanup();
    });

    effect(() => {
      // Reacciona a cambios en resultados, centro, radio o selección
      const res = this.results();
      const center = this.searchCenter();
      const radius = this.radiusKm();
      const selectedId = this.selectedPropertyId();

      if (this.isInitialized && this.mapInstance && !this.isUnavailable()) {
        this.renderLayers(res, center, radius, selectedId);
      }
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  private initMap(): void {
    const container = this.mapContainerRef()?.nativeElement;
    if (!container) return;

    try {
      if (this.tileConfig.simulateFailure) {
        throw new Error('Simulated map initialization failure');
      }

      const center = this.searchCenter();
      const initialLat = center?.latitude ?? 4.6097;
      const initialLng = center?.longitude ?? -74.0817;

      this.mapInstance = L.map(container, {
        center: [initialLat, initialLng],
        zoom: 13,
        zoomControl: true,
        attributionControl: false // Atribución mostrada explícitamente en el elemento visible #map-attribution
      });

      const tileLayer = L.tileLayer(this.tileConfig.tileUrl, {
        maxZoom: this.tileConfig.maxZoom ?? 19,
        attribution: this.tileConfig.attribution
      });

      tileLayer.on('tileerror', () => {
        this.handleTileError();
      });

      tileLayer.on('load', () => {
        this.tileErrorCount = 0;
      });

      tileLayer.addTo(this.mapInstance);

      if (typeof ResizeObserver !== 'undefined') {
        this.resizeObserver = new ResizeObserver(() => {
          this.mapInstance?.invalidateSize();
        });
        this.resizeObserver.observe(container);
      }

      this.isInitialized = true;
      this.renderLayers(
        this.results(),
        this.searchCenter(),
        this.radiusKm(),
        this.selectedPropertyId()
      );
    } catch {
      this.setDegraded();
    }
  }

  private renderLayers(
    results: PropertySearchResult[],
    centerCoords: LocationCoordinates | null,
    radiusKm: number,
    selectedId: string | null
  ): void {
    if (!this.mapInstance) return;

    // Limpiar marcadores y radio anteriores (Req 13: no acumular capas antiguas)
    this.markersMap.forEach((marker) => marker.remove());
    this.markersMap.clear();

    if (this.centerMarker) {
      this.centerMarker.remove();
      this.centerMarker = null;
    }
    if (this.radiusCircle) {
      this.radiusCircle.remove();
      this.radiusCircle = null;
    }

    // Dibujar centro y radio si están disponibles
    let centerLatLng: L.LatLng | null = null;
    if (centerCoords) {
      centerLatLng = L.latLng(centerCoords.latitude, centerCoords.longitude);

      this.centerMarker = L.marker(centerLatLng, {
        icon: createCenterMarkerIcon(),
        interactive: false,
        zIndexOffset: -100
      }).addTo(this.mapInstance);

      if (radiusKm > 0) {
        this.radiusCircle = L.circle(centerLatLng, {
          radius: radiusKm * 1000,
          color: '#2563eb',
          weight: 2,
          fillColor: '#3b82f6',
          fillOpacity: 0.08,
          interactive: false
        }).addTo(this.mapInstance);
      }
    }

    // Dibujar marcadores de propiedades
    results.forEach((property) => {
      const isSelected = property.id === selectedId;
      const marker = L.marker([property.latitude, property.longitude], {
        icon: createPropertyMarkerIcon(isSelected, property.ownedByCurrentUser),
        title: property.name,
        zIndexOffset: isSelected ? 1000 : 100
      });

      const mineTag = property.ownedByCurrentUser
        ? '<div class="popup-mine-tag">Tu inmueble</div>'
        : '';
      const popupContent = `
        <div class="property-popup">
          <div class="popup-header">
            <strong>${property.name}</strong>
            ${mineTag}
          </div>
          <div class="popup-address">${property.address}, ${property.city}</div>
          <div class="popup-footer">
            <span>${property.areaM2} m²</span>
            <span class="popup-distance">${formatDistance(property.distanceKm)}</span>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent, { closeButton: false, offset: [0, -10] });

      marker.on('click', () => {
        this.propertySelected.emit(property);
      });

      marker.addTo(this.mapInstance!);
      this.markersMap.set(property.id, marker);

      if (isSelected) {
        marker.openPopup();
      }
    });

    // Auto-fit bounds (Req 14)
    this.adjustViewport(centerLatLng);
  }

  private adjustViewport(centerLatLng: L.LatLng | null): void {
    if (!this.mapInstance) return;

    if (this.radiusCircle) {
      const bounds = this.radiusCircle.getBounds();
      this.markersMap.forEach((m) => bounds.extend(m.getLatLng()));
      this.mapInstance.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
    } else if (this.markersMap.size > 0) {
      const group = L.featureGroup(Array.from(this.markersMap.values()));
      this.mapInstance.fitBounds(group.getBounds(), { padding: [24, 24], maxZoom: 16 });
    } else if (centerLatLng) {
      this.mapInstance.setView(centerLatLng, 13);
    }
  }

  private handleTileError(): void {
    this.tileErrorCount++;
    // Fallo sostenido de tiles (Req 18)
    if (this.tileErrorCount >= 5 && !this.isUnavailable()) {
      this.setDegraded();
    }
  }

  private setDegraded(): void {
    this.cleanup();
    this.isUnavailable.set(true);
    this.mapUnavailable.emit(true);
  }

  private cleanup(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    this.markersMap.forEach((m) => m.remove());
    this.markersMap.clear();

    if (this.centerMarker) {
      this.centerMarker.remove();
      this.centerMarker = null;
    }
    if (this.radiusCircle) {
      this.radiusCircle.remove();
      this.radiusCircle = null;
    }

    if (this.mapInstance) {
      this.mapInstance.remove();
      this.mapInstance = null;
    }
    this.isInitialized = false;
  }
}
