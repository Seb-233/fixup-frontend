import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { PropertyControllerService, PropertySearchResult } from '../../../api/generated';
import { PropertySearchStore } from './property-search.store';

describe('PropertySearchStore (FR-UC-06)', () => {
  let store: PropertySearchStore;
  let searchSpy: ReturnType<typeof vi.fn>;

  const mockResults: PropertySearchResult[] = [
    {
      id: 'prop-1',
      name: 'Apartamento Chapinero',
      address: 'Cra 7 # 50-20',
      city: 'Bogotá',
      areaM2: 65,
      latitude: 4.65,
      longitude: -74.05,
      distanceKm: 0.45,
      ownedByCurrentUser: false
    },
    {
      id: 'prop-2',
      name: 'Mi Casa',
      address: 'Calle 60 # 10-15',
      city: 'Bogotá',
      areaM2: 120,
      latitude: 4.655,
      longitude: -74.052,
      distanceKm: 1.2,
      ownedByCurrentUser: true
    }
  ];

  beforeEach(() => {
    searchSpy = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        PropertySearchStore,
        {
          provide: PropertyControllerService,
          useValue: { search: searchSpy }
        }
      ]
    });
    store = TestBed.inject(PropertySearchStore);
  });

  it('estado inicial idle sin resultados ni errores', () => {
    expect(store.state()).toBe('idle');
    expect(store.results()).toEqual([]);
    expect(store.error()).toBeNull();
    expect(store.lastParams()).toBeNull();
    expect(store.selectedPropertyId()).toBeNull();
    expect(store.selectedProperty()).toBeNull();
    expect(store.isSearching()).toBe(false);
  });

  it('search pasa inmediatamente a searching y limpia errores previos', () => {
    const subject = new Subject<PropertySearchResult[]>();
    searchSpy.mockReturnValue(subject);

    store.search({ latitude: 4.65, longitude: -74.05, radiusKm: 5 });

    expect(store.state()).toBe('searching');
    expect(store.isSearching()).toBe(true);
    expect(store.error()).toBeNull();
    expect(store.lastParams()).toEqual({ latitude: 4.65, longitude: -74.05, radiusKm: 5 });
  });

  it('respuesta con resultados pasa a success y almacena los resultados', () => {
    searchSpy.mockReturnValue(of(mockResults));

    store.search({ latitude: 4.65, longitude: -74.05, radiusKm: 5 });

    expect(store.state()).toBe('success');
    expect(store.isSearching()).toBe(false);
    expect(store.results()).toEqual(mockResults);
    expect(store.error()).toBeNull();
  });

  it('respuesta [] pasa a empty sin errores', () => {
    searchSpy.mockReturnValue(of([]));

    store.search({ latitude: 4.65, longitude: -74.05, radiusKm: 5 });

    expect(store.state()).toBe('empty');
    expect(store.isSearching()).toBe(false);
    expect(store.results()).toEqual([]);
    expect(store.error()).toBeNull();
  });

  it('error HTTP pasa a apiError y registra el mensaje sin borrar lastParams', () => {
    searchSpy.mockReturnValue(throwError(() => new Error('Network error')));

    store.search({ latitude: 4.65, longitude: -74.05, radiusKm: 5 });

    expect(store.state()).toBe('apiError');
    expect(store.isSearching()).toBe(false);
    expect(store.error()).toContain('Network error');
    expect(store.lastParams()).toEqual({ latitude: 4.65, longitude: -74.05, radiusKm: 5 });
  });

  it('envía parámetros como strings al cliente generado', () => {
    searchSpy.mockReturnValue(of([]));

    store.search({ latitude: 4.65, longitude: -74.05, radiusKm: 10 });

    expect(searchSpy).toHaveBeenCalledWith('4.65', '-74.05', '10', undefined);
  });

  it('OWNER ALL envía ownershipScope ALL al cliente generado', () => {
    searchSpy.mockReturnValue(of([]));

    store.search({ latitude: 4.65, longitude: -74.05, radiusKm: 3, ownershipScope: 'ALL' });

    expect(searchSpy).toHaveBeenCalledWith('4.65', '-74.05', '3', 'ALL');
  });

  it('OWNER MINE envía ownershipScope MINE al cliente generado', () => {
    searchSpy.mockReturnValue(of([]));

    store.search({ latitude: 4.65, longitude: -74.05, radiusKm: 3, ownershipScope: 'MINE' });

    expect(searchSpy).toHaveBeenCalledWith('4.65', '-74.05', '3', 'MINE');
  });

  it('OWNER OTHERS envía ownershipScope OTHERS al cliente generado', () => {
    searchSpy.mockReturnValue(of([]));

    store.search({ latitude: 4.65, longitude: -74.05, radiusKm: 3, ownershipScope: 'OTHERS' });

    expect(searchSpy).toHaveBeenCalledWith('4.65', '-74.05', '3', 'OTHERS');
  });

  it('TENANT ALL envía ownershipScope ALL al cliente generado', () => {
    searchSpy.mockReturnValue(of([]));

    store.search({ latitude: 4.65, longitude: -74.05, radiusKm: 5, ownershipScope: 'ALL' });

    expect(searchSpy).toHaveBeenCalledWith('4.65', '-74.05', '5', 'ALL');
  });

  it('no altera resultados mediante filtros locales (confía en el backend)', () => {
    searchSpy.mockReturnValue(of(mockResults));

    // Si pedimos MINE, el store almacena lo que el backend devuelva directamente
    store.search({ latitude: 4.65, longitude: -74.05, radiusKm: 5, ownershipScope: 'MINE' });

    expect(store.results()).toEqual(mockResults);
  });

  it('reintento vuelve a invocar search con los últimos parámetros', () => {
    searchSpy.mockReturnValue(throwError(() => new Error('Error')));
    store.search({ latitude: 4.65, longitude: -74.05, radiusKm: 5, ownershipScope: 'ALL' });

    expect(searchSpy).toHaveBeenCalledTimes(1);

    searchSpy.mockReturnValue(of(mockResults));
    store.retry();

    expect(searchSpy).toHaveBeenCalledTimes(2);
    expect(searchSpy).toHaveBeenLastCalledWith('4.65', '-74.05', '5', 'ALL');
    expect(store.state()).toBe('success');
    expect(store.results()).toEqual(mockResults);
  });

  it('selección y reseteo de propiedad', () => {
    searchSpy.mockReturnValue(of(mockResults));
    store.search({ latitude: 4.65, longitude: -74.05, radiusKm: 5 });

    store.selectProperty('prop-2');
    expect(store.selectedPropertyId()).toBe('prop-2');
    expect(store.selectedProperty()?.name).toBe('Mi Casa');

    store.reset();
    expect(store.state()).toBe('idle');
    expect(store.results()).toEqual([]);
    expect(store.selectedPropertyId()).toBeNull();
    expect(store.selectedProperty()).toBeNull();
  });
});
