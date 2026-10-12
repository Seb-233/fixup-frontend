import { ComponentFixture, TestBed } from '@angular/core/testing';
import * as L from 'leaflet';
import { PropertySearchResult } from '../../../../api/generated';
import { LocationCoordinates } from '../../models/location.models';
import { MAP_TILE_CONFIG, MapTileConfig } from '../../services/tile-provider.config';
import { PropertyMapComponent } from './property-map.component';

describe('PropertyMapComponent (FR-UC-06 / F7)', () => {
  let fixture: ComponentFixture<PropertyMapComponent>;
  let component: PropertyMapComponent;
  let host: HTMLElement;

  const mockTileConfig: MapTileConfig = {
    tileUrl: 'https://example.com/tiles/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18
  };

  const sampleResults: PropertySearchResult[] = [
    {
      id: 'prop-1',
      name: 'Apartamento Chapinero',
      address: 'Cra 7 # 53-10',
      city: 'Bogotá',
      areaM2: 70,
      latitude: 4.651,
      longitude: -74.052,
      distanceKm: 0.15,
      ownedByCurrentUser: false
    },
    {
      id: 'prop-2',
      name: 'Casa Usaquén',
      address: 'Calle 120 # 7-10',
      city: 'Bogotá',
      areaM2: 120,
      latitude: 4.698,
      longitude: -74.031,
      distanceKm: 1.8,
      ownedByCurrentUser: true
    }
  ];

  const sampleCenter: LocationCoordinates = {
    latitude: 4.65,
    longitude: -74.05
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PropertyMapComponent],
      providers: [{ provide: MAP_TILE_CONFIG, useValue: mockTileConfig }]
    });

    fixture = TestBed.createComponent(PropertyMapComponent);
    component = fixture.componentInstance;
    host = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('inicializa el contenedor del mapa y muestra la atribución configurada', () => {
    fixture.detectChanges();

    const mapContainer = host.querySelector('#property-map-container');
    expect(mapContainer).not.toBeNull();
    const attribution = host.querySelector('#map-attribution');
    expect(attribution?.textContent).toContain('© OpenStreetMap contributors');
    expect(component.isUnavailable()).toBe(false);
  });

  it('renderiza marcadores para cada resultado de propiedad con sus coordenadas', () => {
    fixture.componentRef.setInput('searchCenter', sampleCenter);
    fixture.componentRef.setInput('radiusKm', 5);
    fixture.componentRef.setInput('results', sampleResults);
    fixture.detectChanges();

    // Comprobar que los marcadores existen
    const markers = (component as unknown as { markersMap: Map<string, L.Marker> }).markersMap;
    expect(markers.size).toBe(2);
    expect(markers.has('prop-1')).toBe(true);
    expect(markers.has('prop-2')).toBe(true);

    const marker1 = markers.get('prop-1');
    const marker2 = markers.get('prop-2');
    expect(marker1?.getLatLng().lat).toBeCloseTo(4.651);
    expect(marker1?.getLatLng().lng).toBeCloseTo(-74.052);
    expect(marker2?.getLatLng().lat).toBeCloseTo(4.698);
    expect(marker2?.getLatLng().lng).toBeCloseTo(-74.031);
  });

  it('dibuja el círculo con radiusKm y el marcador del centro de búsqueda', () => {
    fixture.componentRef.setInput('searchCenter', sampleCenter);
    fixture.componentRef.setInput('radiusKm', 3);
    fixture.detectChanges();

    const circle = (component as unknown as { radiusCircle: L.Circle | null }).radiusCircle;
    const centerMarker = (component as unknown as { centerMarker: L.Marker | null }).centerMarker;

    expect(circle).not.toBeNull();
    expect(circle?.getRadius()).toBe(3000); // 3 km en metros
    expect(centerMarker).not.toBeNull();
    expect(centerMarker?.getLatLng().lat).toBeCloseTo(sampleCenter.latitude);
  });

  it('emite propertySelected al pulsar un marcador de propiedad', () => {
    fixture.componentRef.setInput('results', sampleResults);
    fixture.detectChanges();

    const emitted: PropertySearchResult[] = [];
    component.propertySelected.subscribe((p) => emitted.push(p));

    const markers = (component as unknown as { markersMap: Map<string, L.Marker> }).markersMap;
    const marker1 = markers.get('prop-1');
    expect(marker1).toBeDefined();

    marker1?.fire('click');

    expect(emitted).toEqual([sampleResults[0]]);
  });

  it('abre el popup y resalta el marcador cuando coincide con selectedPropertyId', () => {
    fixture.componentRef.setInput('results', sampleResults);
    fixture.componentRef.setInput('selectedPropertyId', 'prop-2');
    fixture.detectChanges();

    const markers = (component as unknown as { markersMap: Map<string, L.Marker> }).markersMap;
    const marker2 = markers.get('prop-2');
    expect(marker2?.isPopupOpen()).toBe(true);
    expect(marker2?.getPopup()?.getContent()).toContain('Casa Usaquén');
    expect(marker2?.getPopup()?.getContent()).toContain('Tu inmueble');
  });

  it('elimina los marcadores anteriores cuando cambian los resultados', () => {
    fixture.componentRef.setInput('results', sampleResults);
    fixture.detectChanges();

    let markers = (component as unknown as { markersMap: Map<string, L.Marker> }).markersMap;
    expect(markers.size).toBe(2);

    // Nuevos resultados con 1 sola propiedad distinta
    const newResults: PropertySearchResult[] = [
      {
        id: 'prop-3',
        name: 'Apartamento Chico',
        address: 'Cra 15 # 90-10',
        city: 'Bogotá',
        areaM2: 85,
        latitude: 4.675,
        longitude: -74.045,
        distanceKm: 0.5,
        ownedByCurrentUser: false
      }
    ];

    fixture.componentRef.setInput('results', newResults);
    fixture.detectChanges();

    markers = (component as unknown as { markersMap: Map<string, L.Marker> }).markersMap;
    expect(markers.size).toBe(1);
    expect(markers.has('prop-3')).toBe(true);
    expect(markers.has('prop-1')).toBe(false);
  });

  it('no falla si la lista de resultados está vacía', () => {
    fixture.componentRef.setInput('searchCenter', sampleCenter);
    fixture.componentRef.setInput('radiusKm', 5);
    fixture.componentRef.setInput('results', []);
    fixture.detectChanges();

    const markers = (component as unknown as { markersMap: Map<string, L.Marker> }).markersMap;
    expect(markers.size).toBe(0);
    expect(component.isUnavailable()).toBe(false);
  });

  it('activa el modo degradado si la inicialización de Leaflet falla', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PropertyMapComponent],
      providers: [{ provide: MAP_TILE_CONFIG, useValue: { ...mockTileConfig, simulateFailure: true } }]
    });
    const failFixture = TestBed.createComponent(PropertyMapComponent);
    const failComponent = failFixture.componentInstance;
    const unavailableEvents: boolean[] = [];
    failComponent.mapUnavailable.subscribe((v: boolean) => unavailableEvents.push(v));

    failFixture.detectChanges();

    expect(failComponent.isUnavailable()).toBe(true);
    expect(unavailableEvents).toEqual([true]);
    expect((failFixture.nativeElement as HTMLElement).querySelector('#map-degraded-state')).not.toBeNull();
    expect((failFixture.nativeElement as HTMLElement).querySelector('#map-degraded-state')?.textContent).toContain(
      'El mapa no está disponible temporalmente'
    );
  });

  it('activa el modo degradado ante fallos de tiles persistentes', () => {
    fixture.detectChanges();

    const unavailableEvents: boolean[] = [];
    component.mapUnavailable.subscribe((v) => unavailableEvents.push(v));

    // Simular 5 errores consecutivos de tiles
    for (let i = 0; i < 5; i++) {
      (component as unknown as { handleTileError: () => void }).handleTileError();
    }
    fixture.detectChanges();

    expect(component.isUnavailable()).toBe(true);
    expect(unavailableEvents).toEqual([true]);
    expect(host.querySelector('#map-degraded-state')).not.toBeNull();
  });
});
