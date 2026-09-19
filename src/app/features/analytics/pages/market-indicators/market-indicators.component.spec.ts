import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MarketIndicatorsComponent } from './market-indicators.component';
import { provideApi, IndicatorsResponse } from '../../../../api/generated';
import { environment } from '../../../../../environments/environment';

describe('MarketIndicatorsComponent', () => {
  let component: MarketIndicatorsComponent;
  let httpTesting: HttpTestingController;

  const base: IndicatorsResponse = {
    zone: 'CHAPINERO',
    pricePerSquareMeter: 5250000,
    yearOverYearVariationPercent: 3.4,
    averageDaysOnMarket: 52,
    observedAt: '2026-09-18T09:00:00Z',
    freshness: 'LIVE',
    degraded: false,
    source: 'EXTERNAL_PROVIDER',
    synthetic: false
  };

  const url = `${environment.apiOrigin}/analytics/zones/CHAPINERO/market-indicators`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MarketIndicatorsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideApi(environment.apiOrigin)]
    });
    component = TestBed.createComponent(MarketIndicatorsComponent).componentInstance;
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('no debe consultar si la zona está vacía', () => {
    component.zona = '   ';
    component.consultar();

    httpTesting.expectNone(() => true);
    expect(component.cargando()).toBe(false);
  });

  it('debe mostrar un dato en vivo sin marca de degradación', () => {
    component.zona = 'CHAPINERO';
    component.consultar();

    httpTesting.expectOne(url).flush(base);

    expect(component.indicadores()?.freshness).toBe('LIVE');
    expect(component.indicadores()?.degraded).toBe(false);
    expect(component.etiquetaFrescura('LIVE')).toBe('Dato en vivo');
  });

  it('debe marcar el dato degradado conservando su fecha de observación', () => {
    component.zona = 'CHAPINERO';
    component.consultar();

    httpTesting.expectOne(url).flush({
      ...base,
      freshness: 'DEGRADED',
      degraded: true,
      observedAt: '2026-09-14T09:00:00Z'
    });

    const dato = component.indicadores();
    expect(dato?.degraded).toBe(true);
    expect(dato?.observedAt).toBe('2026-09-14T09:00:00Z');
    expect(component.etiquetaFrescura('DEGRADED')).toBe('Último valor conocido');
  });

  it('debe distinguir el dato servido desde la caché', () => {
    component.zona = 'CHAPINERO';
    component.consultar();

    httpTesting.expectOne(url).flush({ ...base, freshness: 'CACHED' });

    expect(component.indicadores()?.degraded).toBe(false);
    expect(component.etiquetaFrescura('CACHED')).toBe('Dato reciente');
  });

  it('debe explicar el 503 como ausencia de dato y no dejar indicadores obsoletos en pantalla', () => {
    component.zona = 'CHAPINERO';
    component.consultar();
    httpTesting.expectOne(url).flush(base);

    component.consultar();
    httpTesting
      .expectOne(url)
      .flush({ code: 'INDICATORS_UNAVAILABLE' }, { status: 503, statusText: 'Service Unavailable' });

    expect(component.indicadores()).toBeNull();
    expect(component.error()).toBe('No hay indicadores disponibles para esa zona en este momento.');
  });

  it('debe recortar la zona antes de consultarla', () => {
    component.zona = '  CHAPINERO  ';
    component.consultar();

    httpTesting.expectOne(url).flush(base);
    expect(component.error()).toBeNull();
  });
});
