import { HttpErrorResponse, HttpEvent, HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, defer, firstValueFrom, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { connectivityInterceptor } from './connectivity.interceptor';
import { ConnectivityService, isConnectionError } from './connectivity.service';

describe('conectividad', () => {
  let connectivity: ConnectivityService;
  const url = `${environment.apiOrigin}/requests/mine`;
  const down = new HttpErrorResponse({ status: 0, url });

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    connectivity = TestBed.inject(ConnectivityService);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const run = (req: HttpRequest<unknown>, next: () => Observable<HttpEvent<unknown>>) =>
    firstValueFrom(TestBed.runInInjectionContext(() => connectivityInterceptor(req, next as never)));

  it('distingue una caída de la red de una respuesta del backend', () => {
    expect(isConnectionError(down)).toBe(true);
    expect(isConnectionError(new HttpErrorResponse({ status: 503 }))).toBe(true);
    expect(isConnectionError(new HttpErrorResponse({ status: 503, error: '<html>Service Unavailable</html>' }))).toBe(true);
    expect(isConnectionError(new HttpErrorResponse({ status: 409 }))).toBe(false);
  });

  it('un 503 con el cuerpo de error de la API es una respuesta y no reintenta ni marca caída', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const unavailable = new HttpErrorResponse({
      status: 503,
      url: `${environment.apiOrigin}/analytics/zones/chapinero/market-indicators`,
      error: { status: 503, code: 'INDICATORS_UNAVAILABLE', message: 'Market indicators are unavailable', path: '/analytics/zones/chapinero/market-indicators' }
    });
    expect(isConnectionError(unavailable)).toBe(false);

    let calls = 0;
    const next = () => defer(() => (calls++, throwError(() => unavailable)));
    await expect(run(new HttpRequest('GET', unavailable.url!), next)).rejects.toBe(unavailable);
    await vi.advanceTimersByTimeAsync(10000);

    expect(calls).toBe(1);
    expect(connectivity.state()).toBe('online');
    expect(connectivity.reconnections()).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reintenta una lectura que no llegó y no marca caída si el segundo intento contesta', async () => {
    let calls = 0;
    // Como el HttpClient real, cada suscripción repite la petición.
    const next = (): Observable<HttpEvent<unknown>> =>
      defer(() => (++calls === 1 ? throwError(() => down) : of(new HttpResponse({ status: 200 }))));
    const result = run(new HttpRequest('GET', url), next);
    await vi.advanceTimersByTimeAsync(1000);
    await result;
    expect(calls).toBe(2);
    expect(connectivity.state()).toBe('online');
  });

  it('no reintenta una escritura y marca la conexión como caída', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    let calls = 0;
    const next = () => defer(() => (calls++, throwError(() => down)));
    await expect(run(new HttpRequest('POST', url, {}), next)).rejects.toBe(down);
    expect(calls).toBe(1);
    expect(connectivity.state()).toBe('offline');
  });

  it('sondea la salud del backend hasta que vuelve y cuenta la reconexión', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    connectivity.reportFailure();
    await vi.advanceTimersByTimeAsync(1000);
    expect(connectivity.state()).toBe('offline');
    await vi.advanceTimersByTimeAsync(2000);

    expect(fetchMock).toHaveBeenCalledWith(`${environment.apiOrigin}/actuator/health`, expect.anything());
    expect(connectivity.state()).toBe('online');
    expect(connectivity.reconnections()).toBe(1);
  });

  it('una respuesta de error del backend también prueba que hay conexión', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    connectivity.reportFailure();
    const conflict = new HttpErrorResponse({ status: 409, url });
    await expect(run(new HttpRequest('POST', url, {}), () => throwError(() => conflict))).rejects.toBe(conflict);
    expect(connectivity.state()).toBe('online');
  });
});
