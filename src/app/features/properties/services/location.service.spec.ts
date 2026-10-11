import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { DEFAULT_LOCATION_OPTIONS, LocationService } from './location.service';

describe('LocationService (FR-UC-06)', () => {
  let service: LocationService;
  let getCurrentPosition: ReturnType<typeof vi.fn>;
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis.navigator, 'geolocation');

  function mockGeolocation(value: unknown): void {
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value,
      configurable: true
    });
  }

  beforeEach(() => {
    getCurrentPosition = vi.fn();
    mockGeolocation({ getCurrentPosition });
    TestBed.configureTestingModule({});
    service = TestBed.inject(LocationService);
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(globalThis.navigator, 'geolocation', originalDescriptor);
    } else {
      delete (globalThis.navigator as unknown as Record<string, unknown>)['geolocation'];
    }
  });

  it('debe devolver las coordenadas cuando se obtiene la ubicación', async () => {
    getCurrentPosition.mockImplementation((ok: PositionCallback) =>
      ok({ coords: { latitude: 4.65, longitude: -74.05, accuracy: 25 } } as GeolocationPosition)
    );

    const result = await firstValueFrom(service.getCurrentLocation());

    expect(result).toEqual({
      status: 'success',
      coordinates: { latitude: 4.65, longitude: -74.05, accuracyMeters: 25 }
    });
  });

  it('debe usar opciones explícitas por defecto y permitir sobrescribirlas', async () => {
    getCurrentPosition.mockImplementation((ok: PositionCallback) =>
      ok({ coords: { latitude: 1, longitude: 2, accuracy: 5 } } as GeolocationPosition)
    );

    await firstValueFrom(service.getCurrentLocation());
    expect(getCurrentPosition.mock.calls[0][2]).toEqual(DEFAULT_LOCATION_OPTIONS);

    await firstValueFrom(service.getCurrentLocation({ enableHighAccuracy: true, timeout: 3000 }));
    expect(getCurrentPosition.mock.calls[1][2]).toEqual({
      ...DEFAULT_LOCATION_OPTIONS,
      enableHighAccuracy: true,
      timeout: 3000
    });
  });

  it.each([
    [1, 'permissionDenied'],
    [2, 'positionUnavailable'],
    [3, 'timeout']
  ] as const)('debe distinguir el código de error %i como %s', async (code, reason) => {
    getCurrentPosition.mockImplementation((_ok: PositionCallback, fail: PositionErrorCallback) =>
      fail({ code, message: 'x' } as GeolocationPositionError)
    );

    const result = await firstValueFrom(service.getCurrentLocation());

    expect(result).toEqual({ status: 'failure', reason });
  });

  it('debe informar unsupported cuando navigator.geolocation no existe', async () => {
    mockGeolocation(undefined);

    expect(service.isSupported()).toBe(false);
    const result = await firstValueFrom(service.getCurrentLocation());

    expect(result).toEqual({ status: 'failure', reason: 'unsupported' });
  });

  it('debe informar unsupported si la API lanza una excepción síncrona', async () => {
    getCurrentPosition.mockImplementation(() => {
      throw new Error('SecurityError');
    });

    const result = await firstValueFrom(service.getCurrentLocation());

    expect(result).toEqual({ status: 'failure', reason: 'unsupported' });
  });

  it('debe ignorar una respuesta tardía si el suscriptor se canceló', () => {
    let success!: PositionCallback;
    getCurrentPosition.mockImplementation((ok: PositionCallback) => {
      success = ok;
    });
    const next = vi.fn();

    service.getCurrentLocation().subscribe(next).unsubscribe();
    success({ coords: { latitude: 1, longitude: 2, accuracy: 1 } } as GeolocationPosition);

    expect(next).not.toHaveBeenCalled();
  });
});
