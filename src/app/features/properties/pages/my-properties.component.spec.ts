import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PropertyControllerService, PropertySummary, provideApi, LocationControllerService } from '../../../api/generated';
import { GeocodingCandidate } from '../models/geocoding.models';
import { GeocodingStore } from '../services/geocoding.store';
import { LocationService } from '../services/location.service';
import { MyPropertiesComponent } from './my-properties.component';

describe('MyPropertiesComponent (FR-UC-06 Geolocation Integration)', () => {
  let fixture: ComponentFixture<MyPropertiesComponent>;
  let component: MyPropertiesComponent;
  let httpTesting: HttpTestingController;
  let locationService: LocationService;

  const property: PropertySummary = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Apartamento 301',
    address: 'Carrera 7 # 40-62, Chapinero, Bogotá, Colombia',
    city: 'Bogotá',
    areaM2: 72
  };

  const candidate: GeocodingCandidate = {
    displayName: 'Carrera 7 # 40-62, Bogotá, Colombia',
    latitude: 4.6285,
    longitude: -74.0645
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MyPropertiesComponent],
      providers: [
        PropertyControllerService,
        LocationControllerService,
        LocationService,
        GeocodingStore,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApi(environment.apiOrigin)
      ]
    });
    httpTesting = TestBed.inject(HttpTestingController);
    locationService = TestBed.inject(LocationService);
    fixture = TestBed.createComponent(MyPropertiesComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
    httpTesting.verify();
    fixture?.destroy();
  });

  function initialize(properties: PropertySummary[] = [property]): void {
    fixture.detectChanges();
    const request = httpTesting.expectOne(`${environment.apiOrigin}/properties/me`);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Accept')).toBe('application/json');
    request.flush(properties);
    fixture.detectChanges();
  }

  it('1. pantalla abre -> mapa ya existe visible desde el inicio con estado inicial esperado', () => {
    initialize();
    expect(component.properties()).toEqual([property]);
    expect(component.loading()).toBe(false);

    // Mapa visible desde el inicio
    const mapElement = fixture.nativeElement.querySelector('app-property-confirm-map');
    expect(mapElement).not.toBeNull();

    // Sin punto confirmado
    expect(component.locationState()).toBe('UNRESOLVED');
    expect(component.confirmedLocation()).toBeNull();

    // Botón registrar propiedad deshabilitado
    const submitBtn = fixture.nativeElement.querySelector('#btn-register-property') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    // Texto auxiliar presente
    const hint = fixture.nativeElement.querySelector('#location-hint');
    expect(hint).not.toBeNull();
    expect(hint.textContent).toContain('Escribe una dirección');
  });

  it('2. dirección incompleta (< 5 caracteres) no dispara geocodificación automática tras debounce', () => {
    vi.useFakeTimers();
    initialize();
    component.form.controls.city.setValue('Bogotá');
    component.form.controls.address.setValue('Carr');
    fixture.detectChanges();

    vi.advanceTimersByTime(800);
    fixture.detectChanges();

    // No debe haber disparado petición geocode
    httpTesting.expectNone((req) => req.url.includes('/locations/geocode'));
    expect(component.locationState()).toBe('UNRESOLVED');
  });

  it('3. usuario termina de escribir dirección válida -> debounce (700ms) -> geocode con address + city', () => {
    vi.useFakeTimers();
    initialize();
    component.form.controls.city.setValue('Bogotá');
    component.form.controls.address.setValue('Carrera 12 # 141-25');
    fixture.detectChanges();

    // Estado resolviendo visible durante debounce
    expect(component.locationState()).toBe('RESOLVING');

    vi.advanceTimersByTime(750);

    const geocodeReq = httpTesting.expectOne((req) => req.url.includes('/locations/geocode'));
    expect(geocodeReq.request.method).toBe('GET');
    expect(decodeURIComponent(geocodeReq.request.params.get('query') ?? '')).toBe('Carrera 12 # 141-25, Bogotá');
    geocodeReq.flush([candidate]);

    expect(component.geocodingStore.candidates()).toEqual([candidate]);
  });

  it('4. geocode exitoso coloca marker, pasa a CONFIRMED y habilita botón registrar propiedad', () => {
    initialize();
    component.form.setValue({
      name: 'Casa familiar',
      address: 'Carrera 7 # 40-62',
      city: 'Bogotá',
      areaM2: 95
    });
    fixture.detectChanges();

    component.lookupLocation();

    const geocodeReq = httpTesting.expectOne((req) => req.url.includes('/locations/geocode'));
    geocodeReq.flush([candidate]);
    fixture.detectChanges();

    expect(component.locationState()).toBe('CONFIRMED');
    expect(component.confirmedLocation()).toEqual(candidate);

    const badge = fixture.nativeElement.querySelector('#confirmed-location-card');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain('Carrera 7 # 40-62, Bogotá, Colombia');

    const submitBtn = fixture.nativeElement.querySelector('#btn-register-property') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);
  });

  it('5. editar dirección confirmada invalida inmediatamente coordenadas previas y tras debounce re-geocodifica', () => {
    vi.useFakeTimers();
    initialize();
    component.form.setValue(
      {
        name: 'Casa',
        address: 'Calle 10 # 20-30',
        city: 'Bogotá',
        areaM2: 80
      },
      { emitEvent: false }
    );
    component.selectCandidate(candidate);
    fixture.detectChanges();
    expect(component.locationState()).toBe('CONFIRMED');

    // Usuario modifica la dirección
    component.form.controls.address.setValue('Calle 11 # 20-30');
    fixture.detectChanges();

    // Invalida inmediatamente el punto confirmado
    expect(component.confirmedLocation()).toBeNull();
    expect(component.locationState()).toBe('RESOLVING');
    expect(component.geocodingStore.candidates()).toEqual([]);

    // Botón registrar vuelve a estar deshabilitado
    const submitBtn = fixture.nativeElement.querySelector('#btn-register-property') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    // Tras debounce dispara nueva geocodificación
    vi.advanceTimersByTime(750);
    const req = httpTesting.expectOne((r) => r.url.includes('/locations/geocode'));
    expect(decodeURIComponent(req.request.params.get('query') ?? '')).toBe('Calle 11 # 20-30, Bogotá');
    req.flush([
      {
        displayName: 'Calle 11 # 20-30, Bogotá, Colombia',
        latitude: 4.61,
        longitude: -74.07
      }
    ]);
    fixture.detectChanges();

    expect(component.locationState()).toBe('CONFIRMED');
    expect(component.confirmedLocation()?.displayName).toBe('Calle 11 # 20-30, Bogotá, Colombia');
  });

  it('6. click sobre mapa ejecuta reverse geocode y actualiza dirección visible a CONFIRMED', () => {
    initialize();
    component.form.setValue({
      name: 'Casa campestre',
      address: '',
      city: 'Bogotá',
      areaM2: 120
    });

    // Simular click en el mapa
    component.onMarkerPositionChanged({ latitude: 4.712, longitude: -74.025 });
    expect(component.isReverseGeocoding()).toBe(true);

    const reverseReq = httpTesting.expectOne((req) => req.url.includes('/locations/reverse-geocode'));
    expect(reverseReq.request.params.get('latitude')).toBe('4.712');
    expect(reverseReq.request.params.get('longitude')).toBe('-74.025');

    const revCandidate: GeocodingCandidate = {
      displayName: 'Carrera 9 # 134-20, Usaquén, Bogotá, Colombia',
      latitude: 4.712,
      longitude: -74.025
    };
    reverseReq.flush([revCandidate]);
    fixture.detectChanges();

    expect(component.isReverseGeocoding()).toBe(false);
    expect(component.locationState()).toBe('CONFIRMED');
    expect(component.confirmedLocation()?.displayName).toBe('Carrera 9 # 134-20, Usaquén, Bogotá, Colombia');
    expect(component.form.controls.address.value).toBe('Carrera 9 # 134-20, Usaquén, Bogotá, Colombia');
    // Mantiene la ciudad que el usuario ya ingresó
    expect(component.form.controls.city.value).toBe('Bogotá');
  });

  it('7. drag marker ejecuta reverse geocode y actualiza dirección completa', () => {
    initialize();
    component.form.setValue({
      name: 'Casa en Chapinero',
      address: 'Calle 10 # 20-30',
      city: 'Bogotá',
      areaM2: 85
    });
    component.selectCandidate(candidate);
    expect(component.locationState()).toBe('CONFIRMED');

    // Simular arrastre del marcador
    component.onMarkerPositionChanged({ latitude: 4.651, longitude: -74.052 });
    expect(component.isReverseGeocoding()).toBe(true);

    const reverseReq = httpTesting.expectOne((req) => req.url.includes('/locations/reverse-geocode'));
    const reverseCandidate: GeocodingCandidate = {
      displayName: 'Carrera 15 # 80-20, Chapinero, Bogotá, Colombia',
      latitude: 4.651,
      longitude: -74.052
    };
    reverseReq.flush([reverseCandidate]);
    fixture.detectChanges();

    expect(component.isReverseGeocoding()).toBe(false);
    expect(component.confirmedLocation()?.latitude).toBe(4.651);
    expect(component.confirmedLocation()?.longitude).toBe(-74.052);
    expect(component.confirmedLocation()?.displayName).toBe('Carrera 15 # 80-20, Chapinero, Bogotá, Colombia');
    // Dirección completa conservada
    expect(component.form.controls.address.value).toBe('Carrera 15 # 80-20, Chapinero, Bogotá, Colombia');
    expect(component.locationState()).toBe('CONFIRMED');
  });

  it('8. Usar mi ubicación obtiene GPS, reverse-geocodifica y confirma punto', () => {
    initialize();
    vi.spyOn(locationService, 'getCurrentLocation').mockReturnValue(
      of({
        status: 'success',
        coordinates: { latitude: 4.69, longitude: -74.03 }
      })
    );

    component.useMyLocation();

    const reverseReq = httpTesting.expectOne((req) => req.url.includes('/locations/reverse-geocode'));
    expect(reverseReq.request.params.get('latitude')).toBe('4.69');
    expect(reverseReq.request.params.get('longitude')).toBe('-74.03');

    const gpsCandidate: GeocodingCandidate = {
      displayName: 'Calle 127 # 15-40, Bogotá, Colombia',
      latitude: 4.69,
      longitude: -74.03
    };
    reverseReq.flush([gpsCandidate]);
    fixture.detectChanges();

    expect(component.locationState()).toBe('CONFIRMED');
    expect(component.confirmedLocation()?.displayName).toBe('Calle 127 # 15-40, Bogotá, Colombia');
    expect(component.form.controls.address.value).toBe('Calle 127 # 15-40, Bogotá, Colombia');
  });

  it('9. GPS rechazado no bloquea el formulario y muestra mensaje amigable permitiendo búsqueda/manual', () => {
    initialize();
    vi.spyOn(locationService, 'getCurrentLocation').mockReturnValue(
      of({
        status: 'failure',
        reason: 'permissionDenied'
      })
    );

    component.useMyLocation();
    fixture.detectChanges();

    expect(component.isLocating()).toBe(false);
    expect(component.locationError()).toContain('No pudimos acceder a tu ubicación');
    expect(fixture.nativeElement.querySelector('#location-gps-error')?.textContent).toContain(
      'No pudimos acceder a tu ubicación'
    );

    // El formulario no está bloqueado
    expect(component.form.controls.address.enabled).toBe(true);
    expect(component.form.controls.city.enabled).toBe(true);
  });

  it('10. propiedad registrada muestra dirección completa en la lista sin truncarla', () => {
    const longAddressProp: PropertySummary = {
      id: '99999999-9999-9999-9999-999999999999',
      name: 'Casa en arriendo Cedritos',
      address: 'Carrera 12 # 141-25, Cedritos, Usaquén, Bogotá',
      city: 'Bogotá',
      areaM2: 100
    };
    initialize([longAddressProp]);

    const card = fixture.nativeElement.querySelector('.property-card');
    expect(card).not.toBeNull();
    const addressEl = card.querySelector('.property-card-address');
    expect(addressEl).not.toBeNull();
    expect(addressEl.textContent).toBe('Carrera 12 # 141-25, Cedritos, Usaquén, Bogotá');
  });

  it('seleccionar candidato habilita creación y POST /properties envía dirección completa, latitude y longitude exactas', () => {
    initialize();
    component.form.setValue({
      name: ' Casa familiar ',
      address: ' Calle 10 # 20-30 ',
      city: ' Bogotá ',
      areaM2: 95
    });
    fixture.detectChanges();

    component.selectCandidate(candidate);
    fixture.detectChanges();

    expect(component.selectedLocation()).toEqual(candidate);
    const submitBtn = fixture.nativeElement.querySelector('#btn-register-property') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);

    component.create();

    const request = httpTesting.expectOne(`${environment.apiOrigin}/properties`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Casa familiar',
      address: 'Carrera 7 # 40-62, Bogotá, Colombia',
      city: 'Bogotá',
      areaM2: 95,
      latitude: 4.6285,
      longitude: -74.0645
    });
    expect(request.request.headers.get('Accept')).toBe('application/json');

    const createdProp: PropertySummary = {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Casa familiar',
      address: 'Carrera 7 # 40-62, Bogotá, Colombia',
      city: 'Bogotá',
      areaM2: 95
    };
    request.flush(createdProp);

    expect(component.properties()[0]).toEqual(createdProp);
    expect(component.form.getRawValue()).toEqual({ name: '', address: '', city: '', areaM2: 0 });
    expect(component.selectedLocation()).toBeNull();
    expect(component.creating()).toBe(false);
    expect(component.createSuccess()).toBe('Propiedad registrada correctamente.');
  });

  it('cambiar city después de seleccionar candidato invalida inmediatamente la selección', () => {
    initialize();
    component.form.setValue({
      name: 'Casa',
      address: 'Calle 10 # 20-30',
      city: 'Bogotá',
      areaM2: 80
    });
    component.selectCandidate(candidate);
    expect(component.selectedLocation()).toEqual(candidate);

    component.form.controls.city.setValue('Medellín');
    fixture.detectChanges();

    expect(component.selectedLocation()).toBeNull();
  });

  it('error geocoding se representa correctamente en la vista', () => {
    initialize();
    component.form.setValue({
      name: 'Casa',
      address: 'Calle Desconocida',
      city: 'Bogotá',
      areaM2: 80
    });

    component.lookupLocation();

    const req = httpTesting.expectOne((r) => r.url.includes('/locations/geocode'));
    req.flush('Service Unavailable', { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();

    expect(component.geocodingStore.errorMessage()).toContain('servicio de ubicación');
    expect(fixture.nativeElement.textContent).toContain('servicio de ubicación');
  });

  it('conserva las propiedades cargadas si la creación falla', () => {
    initialize();
    component.form.setValue({ name: 'Casa', address: 'Calle 1', city: 'Bogotá', areaM2: 60 });
    component.selectCandidate(candidate);
    component.create();

    httpTesting.expectOne(`${environment.apiOrigin}/properties`).flush(null, {
      status: 403,
      statusText: 'Forbidden'
    });

    expect(component.properties()).toEqual([property]);
    expect(component.createError()).toContain('no tiene autorización');
    expect(component.creating()).toBe(false);
  });

  it('falla de reverse geocoding mantiene coordenadas sin perder estado de confirmación con advertencia visual', () => {
    initialize();
    component.form.setValue({
      name: 'Casa',
      address: 'Calle 10 # 20-30',
      city: 'Bogotá',
      areaM2: 85
    });
    component.selectCandidate(candidate);

    component.onMarkerPositionChanged({ latitude: 4.70, longitude: -74.03 });
    const reverseReq = httpTesting.expectOne((req) => req.url.includes('/locations/reverse-geocode'));
    reverseReq.flush('Error interno', { status: 500, statusText: 'Server Error' });

    expect(component.isReverseGeocoding()).toBe(false);
    expect(component.confirmedLocation()?.latitude).toBe(4.70);
    expect(component.confirmedLocation()?.longitude).toBe(-74.03);
    expect(component.locationState()).toBe('CONFIRMED');
    expect(component.reverseGeocodeWarning()).toContain('No pudimos actualizar la dirección automáticamente');
  });
});
