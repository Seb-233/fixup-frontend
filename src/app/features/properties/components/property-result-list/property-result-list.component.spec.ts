import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PropertySearchResult } from '../../../../api/generated';
import {
  PropertyResultListComponent,
  formatDistance
} from './property-result-list.component';

describe('PropertyResultListComponent (FR-UC-06)', () => {
  let fixture: ComponentFixture<PropertyResultListComponent>;
  let component: PropertyResultListComponent;
  let host: HTMLElement;

  const sampleResults: PropertySearchResult[] = [
    {
      id: 'prop-1',
      name: 'Casa en Cedritos',
      address: 'Calle 140 # 15-20',
      city: 'Bogotá',
      areaM2: 95,
      latitude: 4.72,
      longitude: -74.03,
      distanceKm: 0.35,
      ownedByCurrentUser: false
    },
    {
      id: 'prop-2',
      name: 'Oficina Central',
      address: 'Cra 7 # 72-10',
      city: 'Bogotá',
      areaM2: 150,
      latitude: 4.65,
      longitude: -74.06,
      distanceKm: 2.45,
      ownedByCurrentUser: true
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PropertyResultListComponent]
    });
    fixture = TestBed.createComponent(PropertyResultListComponent);
    component = fixture.componentInstance;
    host = fixture.nativeElement as HTMLElement;
  });

  describe('formatDistance', () => {
    it('muestra metros si distanceKm es menor a 1 km', () => {
      expect(formatDistance(0.35)).toBe('350 m');
      expect(formatDistance(0.05)).toBe('50 m');
      expect(formatDistance(0.999)).toBe('999 m');
    });

    it('muestra kilómetros si distanceKm es mayor o igual a 1 km', () => {
      expect(formatDistance(1.0)).toBe('1.0 km');
      expect(formatDistance(2.45)).toBe('2.5 km');
      expect(formatDistance(12.34)).toBe('12.3 km');
    });
  });

  it('muestra estado vacío cuando la lista de resultados está vacía', () => {
    fixture.componentRef.setInput('results', []);
    fixture.detectChanges();

    const empty = host.querySelector('#property-empty-state');
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toContain('No encontramos inmuebles dentro de este radio.');
    expect(host.querySelectorAll('.property-card').length).toBe(0);
  });

  it('muestra tarjetas para cada propiedad en la lista', () => {
    fixture.componentRef.setInput('results', sampleResults);
    fixture.detectChanges();

    const cards = host.querySelectorAll('.property-card');
    expect(cards.length).toBe(2);
  });

  it('renderiza nombre, dirección, ciudad, área y distancia formateada', () => {
    fixture.componentRef.setInput('results', sampleResults);
    fixture.detectChanges();

    const firstCard = host.querySelectorAll('.property-card')[0];
    expect(firstCard.querySelector('.property-name')?.textContent).toContain('Casa en Cedritos');
    expect(firstCard.querySelector('.property-address')?.textContent).toContain('Calle 140 # 15-20, Bogotá');
    expect(firstCard.querySelector('.property-area')?.textContent).toContain('95 m²');
    expect(firstCard.querySelector('.property-distance')?.textContent).toBe('350 m');
  });

  it('muestra badge "Tu inmueble" únicamente si ownedByCurrentUser es true', () => {
    fixture.componentRef.setInput('results', sampleResults);
    fixture.detectChanges();

    const cards = host.querySelectorAll('.property-card');
    const firstBadge = cards[0].querySelector('.mine-badge');
    const secondBadge = cards[1].querySelector('.mine-badge');

    expect(firstBadge).toBeNull();
    expect(secondBadge).not.toBeNull();
    expect(secondBadge?.textContent).toContain('Tu inmueble');
  });

  it('no muestra ownerUserId en el DOM', () => {
    fixture.componentRef.setInput('results', sampleResults);
    fixture.detectChanges();

    expect(host.textContent).not.toContain('ownerUserId');
  });

  it('emite propertySelected al hacer click en una tarjeta', () => {
    let selected: PropertySearchResult | undefined;
    component.propertySelected.subscribe((val) => (selected = val));

    fixture.componentRef.setInput('results', sampleResults);
    fixture.detectChanges();

    const firstCard = host.querySelectorAll('.property-card')[0] as HTMLElement;
    firstCard.click();

    expect(selected).toEqual(sampleResults[0]);
  });

  it('resalta la tarjeta correspondiente al selectedPropertyId', () => {
    fixture.componentRef.setInput('results', sampleResults);
    fixture.componentRef.setInput('selectedPropertyId', 'prop-2');
    fixture.detectChanges();

    const cards = host.querySelectorAll('.property-card');
    expect(cards[0].classList.contains('is-selected')).toBe(false);
    expect(cards[1].classList.contains('is-selected')).toBe(true);
    expect(cards[1].getAttribute('aria-selected')).toBe('true');
  });
});
