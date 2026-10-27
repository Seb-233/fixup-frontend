import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  input,
  output,
  viewChild
} from '@angular/core';
import * as L from 'leaflet';
import { environment } from '../../../environments/environment';

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  title: string;
  detail?: string;
  /** Resaltado (p. ej. con sello Fix&Rent o propio). */
  highlight?: boolean;
}

// Mapa de OpenStreetMap con marcadores circulares en los colores de la marca. Sin imágenes de
// marcador: los íconos por defecto de Leaflet dependen de rutas de assets que el build no copia.
@Component({
  selector: 'app-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #host class="map" [style.height]="height()" role="region" [attr.aria-label]="label()"></div>`
})
export class MapComponent implements AfterViewInit, OnDestroy {
  readonly points = input<MapPoint[]>([]);
  readonly center = input<[number, number] | null>(null);
  readonly zoom = input(12);
  readonly height = input<string | null>(null);
  readonly label = input('Mapa de inmuebles');
  /** Permite elegir un punto con un clic (formularios de ubicación). */
  readonly pickable = input(false);
  readonly selected = output<string>();
  readonly picked = output<[number, number]>();

  private readonly host = viewChild.required<ElementRef<HTMLDivElement>>('host');
  private map?: L.Map;
  private layer = L.layerGroup();

  constructor() {
    effect(() => {
      const points = this.points();
      const center = this.center();
      if (this.map) this.render(points, center);
    });
  }

  ngAfterViewInit(): void {
    const start = this.center() ?? [4.65, -74.08];
    this.map = L.map(this.host().nativeElement, { scrollWheelZoom: false }).setView(start, this.zoom());
    L.tileLayer(environment.map.tileUrl, {
      attribution: environment.map.attribution,
      maxZoom: environment.map.maxZoom
    }).addTo(this.map);
    this.layer.addTo(this.map);
    if (this.pickable()) {
      this.map.on('click', (event: L.LeafletMouseEvent) => this.picked.emit([event.latlng.lat, event.latlng.lng]));
    }
    this.render(this.points(), this.center());
    // El contenedor puede cambiar de tamaño al montarse dentro de pestañas o rejillas.
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private render(points: MapPoint[], center: [number, number] | null): void {
    if (!this.map) return;
    this.layer.clearLayers();
    const styles = getComputedStyle(document.documentElement);
    const ink = styles.getPropertyValue('--text').trim() || '#2d2e31';
    const accent = styles.getPropertyValue('--accent').trim() || '#ceac78';
    for (const point of points) {
      const marker = L.circleMarker([point.lat, point.lng], {
        radius: point.highlight ? 9 : 7,
        color: ink,
        weight: 2,
        fillColor: point.highlight ? accent : '#ffffff',
        fillOpacity: 1
      });
      marker.bindTooltip(point.detail ? `${point.title} · ${point.detail}` : point.title);
      marker.on('click', () => this.selected.emit(point.id));
      marker.addTo(this.layer);
    }
    if (center) {
      this.map.setView(center, this.map.getZoom() || this.zoom());
    } else if (points.length > 1) {
      this.map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [24, 24], maxZoom: 15 });
    } else if (points.length === 1) {
      this.map.setView([points[0].lat, points[0].lng], 15);
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }
}
