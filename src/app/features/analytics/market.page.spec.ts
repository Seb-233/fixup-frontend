import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { IndicatorsResponse } from '../../data/models';
import { ProjectsApi } from '../../data/projects.api';
import { MarketPage } from './market.page';

describe('MarketPage (FR-UC-15)', () => {
  let fixture: ComponentFixture<MarketPage>;
  let page: MarketPage;
  let response: Subject<IndicatorsResponse>;
  let requested: string[];

  const chapinero: IndicatorsResponse = {
    zone: 'CHAPINERO',
    pricePerSquareMeter: 8_250_000.4,
    yearOverYearVariationPercent: 4.25,
    averageDaysOnMarket: 47,
    observedAt: '2026-10-26T12:00:00Z',
    freshness: 'LIVE',
    degraded: false,
    source: 'EXTERNAL_PROVIDER',
    synthetic: false
  };

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  // Sin whenStable(): mientras el recurso espera la respuesta la aplicación no queda estable.
  function settle(): void {
    TestBed.tick();
    fixture.detectChanges();
  }

  async function consult(zone: string): Promise<void> {
    page.zoneInput = zone;
    page.search();
    settle();
  }

  async function answer(next: (subject: Subject<IndicatorsResponse>) => void): Promise<void> {
    next(response);
    if (!response.closed) response.complete();
    await fixture.whenStable();
    settle();
  }

  beforeEach(async () => {
    requested = [];
    await TestBed.configureTestingModule({
      imports: [MarketPage],
      providers: [
        {
          provide: ProjectsApi,
          useValue: {
            marketIndicators: (zone: string) => {
              requested.push(zone);
              response = new Subject<IndicatorsResponse>();
              return response;
            }
          }
        }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(MarketPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('no consulta la fuente hasta que se elige una zona', () => {
    expect(requested).toEqual([]);
    expect(text()).not.toContain('Consultando');
  });

  it('muestra el estado de carga mientras la fuente responde', async () => {
    await consult('  Chapinero ');
    expect(requested).toEqual(['Chapinero']);
    expect(text()).toContain('Consultando la fuente de mercado…');
  });

  it('pinta los tres indicadores de la zona consultada', async () => {
    await consult('Chapinero');
    await answer((subject) => subject.next(chapinero));
    expect(text()).toContain('chapinero');
    expect(text()).toContain('+4.3 %');
    expect(text()).toContain('47');
    expect(text()).not.toContain('Datos sintéticos');
  });

  it('avisa cuando el valor es sintético o está degradado', async () => {
    await consult('Chapinero');
    await answer((subject) => subject.next({ ...chapinero, synthetic: true, degraded: true, freshness: 'DEGRADED' }));
    expect(text()).toContain('Datos sintéticos');
    expect(text()).toContain('Dato desactualizado');
  });

  it('un 400 explica que la zona no es válida y no ofrece reintentar', async () => {
    await consult('x'.repeat(64));
    await answer((subject) => subject.error(new HttpErrorResponse({ status: 400, error: { code: 'VALIDATION_ERROR' } })));
    expect(text()).toContain('Zona no válida');
    expect(text()).not.toContain('Fuente de mercado no disponible');
    expect(text()).not.toContain('Reintentar');
  });

  it('un 503 explica que la fuente no está disponible y permite reintentar', async () => {
    await consult('Chapinero');
    await answer((subject) => subject.error(new HttpErrorResponse({ status: 503, error: { code: 'MARKET_SOURCE_UNAVAILABLE' } })));
    expect(text()).toContain('Fuente de mercado no disponible');
    expect(text()).not.toContain('Zona no válida');
    expect(text()).toContain('Reintentar');
  });

  it('cualquier otro fallo cae al mensaje genérico', async () => {
    await consult('Chapinero');
    await answer((subject) => subject.error(new HttpErrorResponse({ status: 500 })));
    expect(text()).toContain('La fuente de indicadores no respondió');
    expect(text()).not.toContain('Zona no válida');
    expect(text()).not.toContain('Fuente de mercado no disponible');
  });
});
