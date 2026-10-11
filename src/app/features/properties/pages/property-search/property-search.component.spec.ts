import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { routes } from '../../../../app.routes';
import { roleGuard } from '../../../../core/auth/role.guard';
import { LocationFailureReason, LocationResult } from '../../models/location.models';
import { LocationService } from '../../services/location.service';
import { PropertySearchComponent } from './property-search.component';

describe('PropertySearchComponent (FR-UC-06)', () => {
  let fixture: ComponentFixture<PropertySearchComponent>;
  let host: HTMLElement;
  let httpTesting: HttpTestingController;
  let getCurrentLocation: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getCurrentLocation = vi.fn();
    TestBed.configureTestingModule({
      imports: [PropertySearchComponent],
      providers: [
        { provide: LocationService, useValue: { getCurrentLocation } },
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PropertySearchComponent);
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  });

  afterEach(() => {
    // La feature no debe haber hecho ninguna petición HTTP.
    httpTesting.expectNone(() => true);
    httpTesting.verify();
  });

  const input = (id: string) => host.querySelector(id) as HTMLInputElement;
  const status = () => host.querySelector('#location-status')?.textContent?.trim() ?? '';

  function clickUseLocation(): void {
    input('#use-my-location').click();
    fixture.detectChanges();
  }

  function type(id: string, value: string): void {
    const el = input(id);
    el.value = value;
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('"Usar mi ubicación" llama a LocationService', () => {
    getCurrentLocation.mockReturnValue(new Subject<LocationResult>());

    clickUseLocation();

    expect(getCurrentLocation).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.state()).toBe('locating');
    expect(status()).toContain('Obteniendo tu ubicación');
  });

  it('un éxito llena latitud y longitud y conserva el radio', () => {
    getCurrentLocation.mockReturnValue(
      of<LocationResult>({
        status: 'success',
        coordinates: { latitude: 4.65, longitude: -74.05 }
      })
    );
    const radius = host.querySelector('#search-radius') as HTMLSelectElement;
    radius.selectedIndex = 3; // 10 km
    radius.dispatchEvent(new Event('change'));

    clickUseLocation();

    expect(fixture.componentInstance.state()).toBe('locationReady');
    expect(input('#search-latitude').value).toBe('4.65');
    expect(input('#search-longitude').value).toBe('-74.05');
    expect(radius.options[radius.selectedIndex].textContent?.trim()).toBe('10 km');
  });

  it.each<[LocationFailureReason, string]>([
    ['permissionDenied', 'permiso'],
    ['positionUnavailable', 'No pudimos determinar'],
    ['unsupported', 'no ofrece geolocalización']
  ])('%s deja disponible el ingreso manual', (reason, text) => {
    getCurrentLocation.mockReturnValue(of<LocationResult>({ status: 'failure', reason }));

    clickUseLocation();

    expect(fixture.componentInstance.state()).toBe('locationError');
    expect(status()).toContain(text);
    expect(input('#search-latitude').disabled).toBe(false);
    expect(input('#search-longitude').disabled).toBe(false);
    expect(input('#use-my-location').disabled).toBe(false);

    type('#search-latitude', '4.5');
    type('#search-longitude', '-74.2');
    input('#search-submit').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.searchParameters()).toEqual({
      latitude: 4.5,
      longitude: -74.2,
      radiusKm: 5
    });
  });

  it('timeout presenta un error no bloqueante', () => {
    getCurrentLocation.mockReturnValue(
      of<LocationResult>({ status: 'failure', reason: 'timeout' })
    );

    clickUseLocation();

    expect(status()).toContain('demasiado tiempo');
    expect(input('#use-my-location').disabled).toBe(false);
    expect(input('#search-submit').disabled).toBe(false);
  });

  it('"Buscar propiedades" conserva los parámetros sin hacer HTTP', () => {
    type('#search-latitude', '4.6');
    type('#search-longitude', '-74.1');

    input('#search-submit').click();
    fixture.detectChanges();

    expect(fixture.componentInstance.searchParameters()).toEqual({
      latitude: 4.6,
      longitude: -74.1,
      radiusKm: 5
    });
    expect(host.querySelector('#search-parameters')?.textContent).toContain('radio 5 km');
  });

  it('no conserva parámetros si el formulario es inválido', () => {
    input('#search-submit').click();
    fixture.detectChanges();

    expect(fixture.componentInstance.searchParameters()).toBeNull();
  });
});

describe('Ruta /properties/search (FR-UC-06)', () => {
  const privateRoute = routes.find((r) => r.children && r.canActivate);
  const route = privateRoute?.children?.find((c) => c.path === 'properties/search');

  it('está dentro del shell privado, protegida por roleGuard', () => {
    expect(route).toBeDefined();
    expect(route?.canActivate).toContain(roleGuard);
  });

  it('no fija todavía una lista de roles (decisión de autorización pendiente)', () => {
    expect(route?.data?.['roles']).toBeUndefined();
  });

  it('carga PropertySearchComponent', async () => {
    const component = await (route?.loadComponent as () => Promise<unknown>)();
    expect(component).toBe(PropertySearchComponent);
  });
});
