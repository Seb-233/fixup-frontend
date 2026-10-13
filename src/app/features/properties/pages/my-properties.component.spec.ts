import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { PropertyControllerService, PropertySummary, provideApi, LocationControllerService } from '../../../api/generated';
import { GeocodingCandidate } from '../models/geocoding.models';
import { GeocodingStore } from '../services/geocoding.store';
import { MyPropertiesComponent } from './my-properties.component';

describe('MyPropertiesComponent (FR-UC-06 Geolocation Integration)', () => {
  let fixture: ComponentFixture<MyPropertiesComponent>;
  let component: MyPropertiesComponent;
  let httpTesting: HttpTestingController;

  const property: PropertySummary = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Apartamento 301',
    address: 'Carrera 7 # 40-62',
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
        GeocodingStore,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApi(environment.apiOrigin)
      ]
    });
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(MyPropertiesComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
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

  it('carga las propiedades propias al iniciar', () => {
    initialize();
    expect(component.properties()).toEqual([property]);
    expect(component.loading()).toBe(false);
  });

  it('mantiene el listado vacío cuando el owner no tiene propiedades', () => {
    initialize([]);
    expect(component.properties()).toEqual([]);
    expect(component.loading()).toBe(false);
  });

  it('no permite registrar sin ubicación seleccionada (botón deshabilitado y sin llamada POST)', () => {
    initialize();
    component.form.setValue({
      name: 'Casa familiar',
      address: 'Calle 10 # 20-30',
      city: 'Bogotá',
      areaM2: 95
    });
    fixture.detectChanges();

    const submitBtn = fixture.nativeElement.querySelector('#btn-register-property') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    component.create();
    httpTesting.expectNone(`${environment.apiOrigin}/properties`);
  });

  it('buscar dirección usa /locations/geocode con query construida desde dirección y ciudad', () => {
    initialize();
    component.form.setValue({
      name: 'Casa familiar',
      address: 'Calle 10 # 20-30',
      city: 'Bogotá',
      areaM2: 95
    });
    fixture.detectChanges();

    component.lookupLocation();

    const geocodeReq = httpTesting.expectOne((req) => req.url.includes('/locations/geocode'));
    expect(geocodeReq.request.method).toBe('GET');
    expect(decodeURIComponent(geocodeReq.request.params.get('query') ?? '')).toBe('Calle 10 # 20-30, Bogotá');
    geocodeReq.flush([candidate]);

    expect(component.geocodingStore.candidates()).toEqual([candidate]);
    expect(component.geocodingStore.state()).toBe('candidates');
  });

  it('seleccionar candidato habilita creación y POST /properties envía latitude y longitude exactas', () => {
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
      address: 'Calle 10 # 20-30',
      city: 'Bogotá',
      areaM2: 95,
      latitude: 4.6285,
      longitude: -74.0645
    });
    expect(request.request.headers.get('Accept')).toBe('application/json');

    const createdProp: PropertySummary = {
      id: '22222222-2222-2222-2222-222222222222',
      name: 'Casa familiar',
      address: 'Calle 10 # 20-30',
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

  it('cambiar address después de seleccionar candidato invalida inmediatamente la selección', () => {
    initialize();
    component.form.setValue({
      name: 'Casa',
      address: 'Calle 10 # 20-30',
      city: 'Bogotá',
      areaM2: 80
    });
    component.selectCandidate(candidate);
    expect(component.selectedLocation()).toEqual(candidate);

    component.form.controls.address.setValue('Calle 11 # 20-30');
    fixture.detectChanges();

    expect(component.selectedLocation()).toBeNull();
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
});
