import { HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { LocationControllerService } from '../../../api/generated';
import { GeocodingCandidate } from '../models/geocoding.models';
import { GeocodingStore } from './geocoding.store';

describe('GeocodingStore (FR-UC-06)', () => {
  let store: GeocodingStore;
  let geocodeSpy: ReturnType<typeof vi.fn>;

  const mockCandidates: GeocodingCandidate[] = [
    { displayName: 'Carrera 7, Chapinero, Bogotá', latitude: 4.65, longitude: -74.06 },
    { displayName: 'Carrera 7, Usaquén, Bogotá', latitude: 4.7, longitude: -74.03 }
  ];

  beforeEach(() => {
    geocodeSpy = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        GeocodingStore,
        {
          provide: LocationControllerService,
          useValue: { geocode: geocodeSpy }
        }
      ]
    });
    store = TestBed.inject(GeocodingStore);
  });

  it('inicia en estado idle sin candidatos ni errores', () => {
    expect(store.state()).toBe('idle');
    expect(store.candidates()).toEqual([]);
    expect(store.selectedCandidate()).toBeNull();
    expect(store.error()).toBeNull();
    expect(store.isGeocoding()).toBe(false);
  });

  it('no invoca el servicio si el query está vacío o solo contiene espacios', () => {
    store.geocode('   ');
    expect(geocodeSpy).not.toHaveBeenCalled();
    expect(store.state()).toBe('idle');
  });

  it('pasa a geocoding y consulta el endpoint con la consulta recortada', () => {
    geocodeSpy.mockReturnValue(of(new HttpResponse({ body: mockCandidates })));

    store.geocode('  Calle 72  ');

    expect(geocodeSpy).toHaveBeenCalledWith('Calle 72', 'response');
    expect(store.state()).toBe('candidates');
    expect(store.candidates()).toEqual(mockCandidates);
    expect(store.selectedCandidate()).toBeNull(); // No autoselecciona
  });

  it('extrae el encabezado X-Data-Attribution de la respuesta', () => {
    const headers = new HttpHeaders({ 'X-Data-Attribution': '© OpenStreetMap contributors' });
    geocodeSpy.mockReturnValue(of(new HttpResponse({ body: mockCandidates, headers })));

    store.geocode('Carrera 7');

    expect(store.attribution()).toBe('© OpenStreetMap contributors');
  });

  it('pasa a empty cuando el backend retorna lista vacía', () => {
    geocodeSpy.mockReturnValue(of(new HttpResponse({ body: [] })));

    store.geocode('Dirección Inexistente XYZ');

    expect(store.state()).toBe('empty');
    expect(store.candidates()).toEqual([]);
  });

  it('maneja error 400 como entrada inválida', () => {
    const error = new HttpErrorResponse({ status: 400, statusText: 'Bad Request' });
    geocodeSpy.mockReturnValue(throwError(() => error));

    store.geocode('!');

    expect(store.state()).toBe('error');
    expect(store.errorType()).toBe('invalid_query');
    expect(store.errorMessage()).toContain('La dirección ingresada no es válida');
  });

  it('maneja error 429 como límite de peticiones excedido y permite reintentar', () => {
    const error = new HttpErrorResponse({ status: 429, statusText: 'Too Many Requests' });
    geocodeSpy.mockReturnValue(throwError(() => error));

    store.geocode('Calle 100');

    expect(store.state()).toBe('error');
    expect(store.errorType()).toBe('rate_limit');
    expect(store.errorMessage()).toContain('Temporalmente no se pueden realizar nuevas búsquedas');

    // Retry
    geocodeSpy.mockReturnValue(of(new HttpResponse({ body: mockCandidates })));
    store.retry();

    expect(geocodeSpy).toHaveBeenCalledTimes(2);
    expect(store.state()).toBe('candidates');
  });

  it('maneja error 503 como servicio no disponible', () => {
    const error = new HttpErrorResponse({ status: 503, statusText: 'Service Unavailable' });
    geocodeSpy.mockReturnValue(throwError(() => error));

    store.geocode('Calle 80');

    expect(store.state()).toBe('error');
    expect(store.errorType()).toBe('service_unavailable');
    expect(store.errorMessage()).toContain('El servicio de ubicación por dirección está temporalmente no disponible');
  });

  it('permite seleccionar un candidato y limpiar la selección', () => {
    const candidate = mockCandidates[0];
    store.selectCandidate(candidate);
    expect(store.selectedCandidate()).toEqual(candidate);

    store.clearSelection();
    expect(store.selectedCandidate()).toBeNull();
  });

  it('reset() restaura todos los estados a idle', () => {
    geocodeSpy.mockReturnValue(of(new HttpResponse({ body: mockCandidates })));
    store.geocode('Carrera 15');
    store.selectCandidate(mockCandidates[0]);

    store.reset();

    expect(store.state()).toBe('idle');
    expect(store.candidates()).toEqual([]);
    expect(store.selectedCandidate()).toBeNull();
    expect(store.error()).toBeNull();
    expect(store.attribution()).toBeNull();
  });
});
