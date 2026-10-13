import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LocationCoordinates } from '../../models/location.models';
import { PropertySearchFormValue } from '../../models/property-search.models';
import { GeocodingCandidate } from '../../models/geocoding.models';
import { PropertySearchFiltersComponent } from './property-search-filters.component';

describe('PropertySearchFiltersComponent (FR-UC-06)', () => {
  let fixture: ComponentFixture<PropertySearchFiltersComponent>;
  let component: PropertySearchFiltersComponent;
  let host: HTMLElement;

  const mockCandidates: GeocodingCandidate[] = [
    { displayName: 'Carrera 7 # 53-10, Bogotá', latitude: 4.65, longitude: -74.06 },
    { displayName: 'Carrera 7 # 100-20, Bogotá', latitude: 4.68, longitude: -74.04 }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PropertySearchFiltersComponent] });
    fixture = TestBed.createComponent(PropertySearchFiltersComponent);
    component = fixture.componentInstance;
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  const q = (selector: string) => host.querySelector(selector) as HTMLElement | null;

  function typeAddress(value: string): void {
    const input = q('#search-address') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('no muestra latitud ni longitud como campos', () => {
    expect(q('#search-latitude')).toBeNull();
    expect(q('#search-longitude')).toBeNull();
    expect(host.querySelector('input[type="number"]')).toBeNull();
  });

  it('muestra el campo de dirección con su etiqueta y el botón Buscar dirección', () => {
    expect(q('#search-address')).not.toBeNull();
    expect(q('label[for="search-address"]')?.textContent).toContain('Dirección o zona');
    expect(q('#resolve-address')).not.toBeNull();
    expect(q('#resolve-address')?.textContent).toContain('Buscar dirección');
  });

  it('deshabilita el botón Buscar dirección si el campo está vacío', () => {
    expect((q('#resolve-address') as HTMLButtonElement).disabled).toBe(true);
    typeAddress('  ');
    expect((q('#resolve-address') as HTMLButtonElement).disabled).toBe(true);
    typeAddress('Calle 72');
    expect((q('#resolve-address') as HTMLButtonElement).disabled).toBe(false);
  });

  it('no emite resolveAddress al teclear (sin autocomplete)', () => {
    const resolves: string[] = [];
    component.resolveAddress.subscribe((v) => resolves.push(v));

    typeAddress('Carrera 7');

    expect(resolves).toEqual([]);
  });

  it('emite resolveAddress únicamente al pulsar el botón Buscar dirección', () => {
    const resolves: string[] = [];
    component.resolveAddress.subscribe((v) => resolves.push(v));

    typeAddress('  Calle 100 # 15-20  ');
    (q('#resolve-address') as HTMLButtonElement).click();

    expect(resolves).toEqual(['Calle 100 # 15-20']);
  });

  it('muestra estado de carga de geocodificación', () => {
    fixture.componentRef.setInput('geocoding', true);
    fixture.detectChanges();

    expect(q('#geocoding-loading')?.textContent).toContain('Buscando dirección');
    expect((q('#resolve-address') as HTMLButtonElement).disabled).toBe(true);
  });

  it('muestra mensaje cuando no hay resultados de dirección', () => {
    fixture.componentRef.setInput('geocodingState', 'empty');
    fixture.detectChanges();

    expect(q('#geocoding-empty')?.textContent).toContain('No encontramos ubicaciones para esa dirección');
  });

  it('muestra bloque de error de geocodificación y reintento en error 429', () => {
    fixture.componentRef.setInput('geocodingState', 'error');
    fixture.componentRef.setInput('geocodingError', 'Temporalmente no se pueden realizar nuevas búsquedas');
    fixture.componentRef.setInput('geocodingErrorType', 'rate_limit');
    fixture.detectChanges();

    expect(q('#geocoding-error')?.textContent).toContain('Temporalmente no se pueden realizar nuevas búsquedas');

    let retried = false;
    component.retryGeocoding.subscribe(() => { retried = true; });
    (q('#geocoding-retry') as HTMLButtonElement).click();
    expect(retried).toBe(true);
  });

  it('renderiza la lista de candidatos y su atribución, emitiendo candidateSelected al hacer click', () => {
    fixture.componentRef.setInput('candidates', mockCandidates);
    fixture.componentRef.setInput('attribution', '© OpenStreetMap contributors');
    fixture.detectChanges();

    const options = host.querySelectorAll('.candidate-option');
    expect(options.length).toBe(2);
    expect(options[0].textContent).toContain('Carrera 7 # 53-10, Bogotá');
    expect(options[1].textContent).toContain('Carrera 7 # 100-20, Bogotá');
    expect(q('#geocoding-attribution')?.textContent).toContain('© OpenStreetMap contributors');

    const selected: GeocodingCandidate[] = [];
    component.candidateSelected.subscribe((c) => selected.push(c));
    (options[0] as HTMLButtonElement).click();

    expect(selected).toEqual([mockCandidates[0]]);
  });

  it('muestra el distintivo de dirección seleccionada', () => {
    fixture.componentRef.setInput('selectedCandidate', mockCandidates[0]);
    fixture.detectChanges();

    expect(q('#selected-address-badge')?.textContent).toContain('Carrera 7 # 53-10, Bogotá');
  });

  it('ofrece exactamente los radios 1, 3, 5 y 10 km, con 5 km por defecto', () => {
    const labels = Array.from(host.querySelectorAll('#search-radius option')).map((o) =>
      o.textContent?.trim()
    );
    expect(labels).toEqual(['1 km', '3 km', '5 km', '10 km']);
    expect(component.form.controls.radiusKm.value).toBe(5);
  });

  it('exige radio y que sea estrictamente mayor que 0', () => {
    component.form.controls.radiusKm.setValue(null);
    expect(component.form.controls.radiusKm.hasError('required')).toBe(true);
    component.form.controls.radiusKm.setValue(0);
    expect(component.form.controls.radiusKm.hasError('greaterThanZero')).toBe(true);
    component.form.controls.radiusKm.setValue(1);
    expect(component.form.controls.radiusKm.valid).toBe(true);
  });

  it('emite addressEdited cuando el usuario escribe', () => {
    const edits: string[] = [];
    component.addressEdited.subscribe((v) => edits.push(v));

    typeAddress('Carrera 7');

    expect(edits).toEqual(['Carrera 7']);
  });

  it('emite la búsqueda con la dirección recortada, el radio y el alcance', () => {
    const emitted: PropertySearchFormValue[] = [];
    component.searchRequested.subscribe((v) => emitted.push(v));
    typeAddress('  Calle 10  ');
    component.form.controls.radiusKm.setValue(3);

    component.submit();

    expect(emitted).toEqual([{ addressQuery: 'Calle 10', radiusKm: 3, ownership: 'ALL' }]);
  });

  it('no emite si el radio es inválido y muestra el error', () => {
    const emitted: PropertySearchFormValue[] = [];
    component.searchRequested.subscribe((v) => emitted.push(v));
    component.form.controls.radiusKm.setValue(null);

    component.submit();
    fixture.detectChanges();

    expect(emitted).toEqual([]);
    expect(host.textContent).toContain('Selecciona un radio de búsqueda.');
  });

  it('al recibir coordenadas GPS limpia la dirección sin emitir addressEdited y conserva radio y alcance', () => {
    fixture.componentRef.setInput('showOwnership', true);
    fixture.componentRef.setInput('locationSource', 'gps');
    fixture.detectChanges();
    typeAddress('Calle 1');
    component.form.controls.radiusKm.setValue(10);
    component.form.controls.ownership.setValue('MINE');
    const edits: string[] = [];
    component.addressEdited.subscribe((v) => edits.push(v));

    const coordinates: LocationCoordinates = { latitude: 4.6, longitude: -74.1 };
    fixture.componentRef.setInput('coordinates', coordinates);
    fixture.detectChanges();

    expect(component.form.getRawValue()).toEqual({
      addressQuery: '',
      radiusKm: 10,
      ownership: 'MINE'
    });
    expect(edits).toEqual([]);
  });

  it('oculta el filtro de alcance por defecto (TENANT)', () => {
    expect(q('#search-ownership')).toBeNull();
    expect(host.textContent).not.toContain('Mis inmuebles');
  });

  it('muestra Todos / Mis inmuebles / Otros inmuebles cuando showOwnership es true (OWNER)', () => {
    fixture.componentRef.setInput('showOwnership', true);
    fixture.detectChanges();

    const labels = Array.from(host.querySelectorAll('#search-ownership label')).map((l) =>
      l.textContent?.trim()
    );
    expect(labels).toEqual(['Todos', 'Mis inmuebles', 'Otros inmuebles']);
    expect((q('#ownership-all') as HTMLInputElement).checked).toBe(true);
    expect(q('#search-ownership legend')?.textContent).toContain('Mostrar');
  });

  it('deshabilita las acciones mientras se obtiene la ubicación', () => {
    fixture.componentRef.setInput('locating', true);
    fixture.detectChanges();

    expect((q('#use-my-location') as HTMLButtonElement).disabled).toBe(true);
    expect((q('#search-submit') as HTMLButtonElement).disabled).toBe(true);
    expect(q('#use-my-location')?.textContent).toContain('Obteniendo ubicación');
  });

  it('emite useLocation al pulsar "Usar mi ubicación"', () => {
    let count = 0;
    component.useLocation.subscribe(() => count++);

    q('#use-my-location')?.click();

    expect(count).toBe(1);
  });
});
