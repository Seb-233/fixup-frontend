import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { PropertyControllerService, PropertySummary, provideApi } from '../../../api/generated';
import { MyPropertiesComponent } from './my-properties.component';

describe('MyPropertiesComponent', () => {
  let component: MyPropertiesComponent;
  let httpTesting: HttpTestingController;

  const property: PropertySummary = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Apartamento 301',
    address: 'Carrera 7 # 40-62',
    city: 'Bogotá',
    areaM2: 72
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MyPropertiesComponent],
      providers: [
        PropertyControllerService,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideApi(environment.apiOrigin)
      ]
    });
    httpTesting = TestBed.inject(HttpTestingController);
    component = TestBed.createComponent(MyPropertiesComponent).componentInstance;
  });

  afterEach(() => httpTesting.verify());

  function initialize(properties: PropertySummary[] = [property]): void {
    component.ngOnInit();
    const request = httpTesting.expectOne(`${environment.apiOrigin}/properties/me`);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Accept')).toBe('application/json');
    request.flush(properties);
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

  it('crea una propiedad con exactamente los campos del contrato', () => {
    initialize();
    component.form.setValue({
      name: ' Casa familiar ',
      address: ' Calle 10 # 20-30 ',
      city: ' Bogotá ',
      areaM2: 95
    });

    component.create();

    const request = httpTesting.expectOne(`${environment.apiOrigin}/properties`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Casa familiar',
      address: 'Calle 10 # 20-30',
      city: 'Bogotá',
      areaM2: 95
    });
    expect(request.request.headers.get('Accept')).toBe('application/json');
    request.flush({ ...property, id: '22222222-2222-2222-2222-222222222222', name: 'Casa familiar', areaM2: 95 });

    expect(component.properties()[0].name).toBe('Casa familiar');
    expect(component.form.getRawValue()).toEqual({ name: '', address: '', city: '', areaM2: 0 });
    expect(component.creating()).toBe(false);
    expect(component.createSuccess()).toBe('Propiedad registrada correctamente.');
  });

  it.each([
    { name: '', address: 'Calle 1', city: 'Bogotá', areaM2: 1 },
    { name: 'Casa', address: '', city: 'Bogotá', areaM2: 1 },
    { name: 'Casa', address: 'Calle 1', city: '', areaM2: 1 },
    { name: 'Casa', address: 'Calle 1', city: 'Bogotá', areaM2: 0 },
    { name: 'Casa', address: 'Calle 1', city: 'Bogotá', areaM2: -1 }
  ])('no crea una propiedad con formulario inválido', (value) => {
    component.form.setValue(value);
    component.create();

    expect(component.form.invalid).toBe(true);
    httpTesting.expectNone(`${environment.apiOrigin}/properties`);
  });

  it('conserva las propiedades cargadas si la creación falla', () => {
    initialize();
    component.form.setValue({ name: 'Casa', address: 'Calle 1', city: 'Bogotá', areaM2: 60 });
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
