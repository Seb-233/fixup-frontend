import { ComponentFixture, TestBed } from '@angular/core/testing';
import * as L from 'leaflet';
import { MAP_TILE_CONFIG, MapTileConfig } from '../../services/tile-provider.config';
import { PropertyConfirmMapComponent } from './property-confirm-map.component';

describe('PropertyConfirmMapComponent', () => {
  let fixture: ComponentFixture<PropertyConfirmMapComponent>;
  let component: PropertyConfirmMapComponent;

  const mockTileConfig: MapTileConfig = {
    tileUrl: 'https://example.com/tiles/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    maxZoom: 18
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PropertyConfirmMapComponent],
      providers: [{ provide: MAP_TILE_CONFIG, useValue: mockTileConfig }]
    });

    fixture = TestBed.createComponent(PropertyConfirmMapComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it('inicializa el mapa y renderiza el marcador arrastrable con las coordenadas provistas', () => {
    fixture.componentRef.setInput('latitude', 4.65);
    fixture.componentRef.setInput('longitude', -74.05);
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('#property-confirm-map-container');
    expect(container).not.toBeNull();

    const marker = (component as unknown as { markerInstance: L.Marker | null }).markerInstance;
    expect(marker).not.toBeNull();
    expect(marker?.getLatLng().lat).toBeCloseTo(4.65);
    expect(marker?.getLatLng().lng).toBeCloseTo(-74.05);
  });

  it('emite positionChanged cuando se dispara el evento dragend en el marcador', () => {
    fixture.componentRef.setInput('latitude', 4.65);
    fixture.componentRef.setInput('longitude', -74.05);
    fixture.detectChanges();

    const emitted: { latitude: number; longitude: number }[] = [];
    component.positionChanged.subscribe((coords) => emitted.push(coords));

    const marker = (component as unknown as { markerInstance: L.Marker | null }).markerInstance;
    expect(marker).not.toBeNull();

    // Simular nuevo punto tras arrastre
    marker?.setLatLng([4.67, -74.04]);
    marker?.fire('dragend');

    expect(emitted.length).toBe(1);
    expect(emitted[0].latitude).toBeCloseTo(4.67);
    expect(emitted[0].longitude).toBeCloseTo(-74.04);
  });

  it('muestra el indicador de carga cuando isReverseGeocoding es true', () => {
    fixture.componentRef.setInput('latitude', 4.65);
    fixture.componentRef.setInput('longitude', -74.05);
    fixture.componentRef.setInput('isReverseGeocoding', true);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.reverse-badge');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toContain('Actualizando dirección');
  });
});
