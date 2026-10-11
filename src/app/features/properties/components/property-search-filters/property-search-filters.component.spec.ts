import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LocationCoordinates } from '../../models/location.models';
import { PropertySearchParameters } from '../../models/property-search.models';
import { PropertySearchFiltersComponent } from './property-search-filters.component';

describe('PropertySearchFiltersComponent (FR-UC-06)', () => {
  let fixture: ComponentFixture<PropertySearchFiltersComponent>;
  let component: PropertySearchFiltersComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PropertySearchFiltersComponent] });
    fixture = TestBed.createComponent(PropertySearchFiltersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function valid(): void {
    component.form.setValue({ latitude: 4.65, longitude: -74.05, radiusKm: 5 });
  }

  it('el formulario es inválido inicialmente', () => {
    expect(component.form.invalid).toBe(true);
    expect(component.form.controls.latitude.hasError('required')).toBe(true);
    expect(component.form.controls.longitude.hasError('required')).toBe(true);
  });

  it.each([-90.1, 91])('rechaza latitud fuera de rango (%s)', (latitude) => {
    valid();
    component.form.controls.latitude.setValue(latitude);
    expect(component.form.controls.latitude.invalid).toBe(true);
  });

  it.each([-90, 90])('acepta latitud en el límite (%s)', (latitude) => {
    valid();
    component.form.controls.latitude.setValue(latitude);
    expect(component.form.controls.latitude.valid).toBe(true);
  });

  it.each([-180.1, 181])('rechaza longitud fuera de rango (%s)', (longitude) => {
    valid();
    component.form.controls.longitude.setValue(longitude);
    expect(component.form.controls.longitude.invalid).toBe(true);
  });

  it.each([-180, 180])('acepta longitud en el límite (%s)', (longitude) => {
    valid();
    component.form.controls.longitude.setValue(longitude);
    expect(component.form.controls.longitude.valid).toBe(true);
  });

  it('exige radio y que sea estrictamente mayor que 0', () => {
    valid();
    component.form.controls.radiusKm.setValue(null);
    expect(component.form.controls.radiusKm.hasError('required')).toBe(true);
    component.form.controls.radiusKm.setValue(0);
    expect(component.form.controls.radiusKm.hasError('greaterThanZero')).toBe(true);
    component.form.controls.radiusKm.setValue(1);
    expect(component.form.controls.radiusKm.valid).toBe(true);
  });

  it('ofrece exactamente los radios 1, 3, 5 y 10 km', () => {
    const labels = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('#search-radius option')
    ).map((o) => o.textContent?.trim());
    expect(labels).toEqual(['1 km', '3 km', '5 km', '10 km']);
  });

  it('emite los parámetros cuando el formulario es válido', () => {
    const emitted: PropertySearchParameters[] = [];
    component.searchRequested.subscribe((p) => emitted.push(p));
    component.form.setValue({ latitude: 4.65, longitude: -74.05, radiusKm: 3 });

    component.submit();

    expect(emitted).toEqual([{ latitude: 4.65, longitude: -74.05, radiusKm: 3 }]);
  });

  it('no emite y muestra errores cuando el formulario es inválido', () => {
    const emitted: PropertySearchParameters[] = [];
    component.searchRequested.subscribe((p) => emitted.push(p));

    component.submit();
    fixture.detectChanges();

    expect(emitted).toEqual([]);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Ingresa la latitud.');
    expect(text).toContain('Ingresa la longitud.');
  });

  it('conserva el radio elegido al recibir coordenadas', () => {
    component.form.controls.radiusKm.setValue(10);
    const coordinates: LocationCoordinates = { latitude: 4.6, longitude: -74.1 };

    fixture.componentRef.setInput('coordinates', coordinates);
    fixture.detectChanges();

    expect(component.form.getRawValue()).toEqual({
      latitude: 4.6,
      longitude: -74.1,
      radiusKm: 10
    });
  });

  it('deshabilita las acciones mientras se obtiene la ubicación', () => {
    fixture.componentRef.setInput('locating', true);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    expect((host.querySelector('#use-my-location') as HTMLButtonElement).disabled).toBe(true);
    expect((host.querySelector('#search-submit') as HTMLButtonElement).disabled).toBe(true);
    expect(host.querySelector('#use-my-location')?.textContent).toContain('Obteniendo ubicación');
  });

  it('emite useLocation al pulsar "Usar mi ubicación"', () => {
    let count = 0;
    component.useLocation.subscribe(() => count++);

    ((fixture.nativeElement as HTMLElement).querySelector('#use-my-location') as HTMLElement).click();

    expect(count).toBe(1);
  });
});
