import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { routes } from '../../../../app.routes';
import { Role } from '../../../../core/auth/auth.types';
import { CurrentUserStore } from '../../../../core/auth/current-user.store';
import { roleGuard } from '../../../../core/auth/role.guard';
import { LocationFailureReason, LocationResult } from '../../models/location.models';
import { LocationService } from '../../services/location.service';
import { PropertySearchComponent } from './property-search.component';

describe('PropertySearchComponent (FR-UC-06)', () => {
  let fixture: ComponentFixture<PropertySearchComponent>;
  let host: HTMLElement;
  let httpTesting: HttpTestingController;
  let getCurrentLocation: ReturnType<typeof vi.fn>;

  const gpsSuccess = of<LocationResult>({
    status: 'success',
    coordinates: { latitude: 4.65, longitude: -74.05 }
  });

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
  });

  afterEach(() => {
    // La feature no debe haber hecho ninguna petición HTTP.
    httpTesting.expectNone(() => true);
    httpTesting.verify();
  });

  function create(role: Role): void {
    const store = TestBed.inject(CurrentUserStore);
    store.setRoles([role]);
    store.setActiveRole(role);
    fixture = TestBed.createComponent(PropertySearchComponent);
    host = fixture.nativeElement as HTMLElement;
    fixture.detectChanges();
  }

  const el = (selector: string) => host.querySelector(selector) as HTMLInputElement;
  const status = () => host.querySelector('#location-status')?.textContent?.trim() ?? '';
  const page = () => fixture.componentInstance;

  function clickUseLocation(): void {
    el('#use-my-location').click();
    fixture.detectChanges();
  }

  function typeAddress(value: string): void {
    const input = el('#search-address');
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function clickSearch(): void {
    el('#search-submit').click();
    fixture.detectChanges();
  }

  it('no muestra latitud ni longitud y sí un campo de dirección', () => {
    create('TENANT');

    expect(el('#search-latitude')).toBeNull();
    expect(el('#search-longitude')).toBeNull();
    expect(el('#search-address')).not.toBeNull();
    expect(host.querySelector('h1')?.textContent).toContain('Explorar inmuebles');
  });

  it('"Usar mi ubicación" llama a LocationService y pasa a locating', () => {
    create('TENANT');
    getCurrentLocation.mockReturnValue(new Subject<LocationResult>());

    clickUseLocation();

    expect(getCurrentLocation).toHaveBeenCalledTimes(1);
    expect(page().state()).toBe('locating');
    expect(status()).toContain('Obteniendo tu ubicación');
  });

  it('el GPS llena las coordenadas internas sin mostrarlas y conserva el radio', () => {
    create('TENANT');
    getCurrentLocation.mockReturnValue(gpsSuccess);
    const radius = el('#search-radius') as unknown as HTMLSelectElement;
    radius.selectedIndex = 3; // 10 km
    radius.dispatchEvent(new Event('change'));

    clickUseLocation();

    expect(page().state()).toBe('locationReady');
    expect(page().locationSource()).toBe('gps');
    expect(page().coordinates()).toEqual({ latitude: 4.65, longitude: -74.05 });
    expect(status()).toContain('ubicación actual');
    expect(host.textContent).not.toContain('4.65');
    expect(host.textContent).not.toContain('-74.05');
    expect(radius.options[radius.selectedIndex].textContent?.trim()).toBe('10 km');
  });

  it('con GPS listo "Buscar propiedades" produce los parámetros (TENANT sin alcance)', () => {
    create('TENANT');
    getCurrentLocation.mockReturnValue(gpsSuccess);
    clickUseLocation();

    clickSearch();

    expect(page().searchParameters()).toEqual({
      latitude: 4.65,
      longitude: -74.05,
      radiusKm: 5
    });
    expect(host.querySelector('#search-parameters')?.textContent).toContain('ubicación actual');
    expect(host.querySelector('#search-parameters')?.textContent).toContain('radio 5 km');
    expect(page().locationRequired()).toBe(false);
  });

  it.each([
    ['#ownership-all', 'ALL'],
    ['#ownership-mine', 'MINE'],
    ['#ownership-others', 'OTHERS']
  ])('OWNER incluye el alcance elegido (%s) en los parámetros', (selector, expected) => {
    create('OWNER');
    getCurrentLocation.mockReturnValue(gpsSuccess);
    clickUseLocation();
    el(selector).click();
    fixture.detectChanges();

    clickSearch();

    expect(page().searchParameters()?.ownership).toBe(expected);
  });

  it('OWNER ve Todos / Mis inmuebles / Otros inmuebles', () => {
    create('OWNER');

    const labels = Array.from(host.querySelectorAll('#search-ownership label')).map((l) =>
      l.textContent?.trim()
    );
    expect(labels).toEqual(['Todos', 'Mis inmuebles', 'Otros inmuebles']);
  });

  it('TENANT no ve el filtro de alcance', () => {
    create('TENANT');

    expect(el('#search-ownership')).toBeNull();
    expect(host.textContent).not.toContain('Otros inmuebles');
  });

  it('una dirección escrita queda pendiente y no genera coordenadas', () => {
    create('TENANT');

    typeAddress('Calle 10 # 20-30');

    expect(page().state()).toBe('addressPending');
    expect(page().locationSource()).toBe('address');
    expect(page().coordinates()).toBeNull();
    expect(status()).toContain('Aún no se ha convertido');
  });

  it('buscar con una dirección sin geocodificar no produce parámetros y pide una ubicación válida', () => {
    create('TENANT');
    typeAddress('Calle 10 # 20-30');

    clickSearch();

    expect(page().searchParameters()).toBeNull();
    expect(page().coordinates()).toBeNull();
    expect(host.querySelector('#search-hint')?.textContent).toContain(
      'Selecciona una ubicación válida para continuar.'
    );
    expect(host.querySelector('#search-parameters')).toBeNull();
  });

  it('buscar sin indicar nada tampoco produce parámetros', () => {
    create('TENANT');

    clickSearch();

    expect(page().searchParameters()).toBeNull();
    expect(host.querySelector('#search-hint')).not.toBeNull();
  });

  it('escribir una dirección después del GPS descarta las coordenadas del GPS', () => {
    create('TENANT');
    getCurrentLocation.mockReturnValue(gpsSuccess);
    clickUseLocation();

    typeAddress('Avenida 68');

    expect(page().coordinates()).toBeNull();
    expect(page().state()).toBe('addressPending');
    clickSearch();
    expect(page().searchParameters()).toBeNull();
  });

  it('el GPS reemplaza el texto de dirección escrito', () => {
    create('TENANT');
    typeAddress('Avenida 68');
    getCurrentLocation.mockReturnValue(gpsSuccess);

    clickUseLocation();

    expect(el('#search-address').value).toBe('');
    expect(page().state()).toBe('locationReady');
  });

  it('escribir una dirección cancela una lectura de GPS en curso', () => {
    create('TENANT');
    const pending = new Subject<LocationResult>();
    getCurrentLocation.mockReturnValue(pending);
    clickUseLocation();

    typeAddress('Avenida 68');
    pending.next({ status: 'success', coordinates: { latitude: 1, longitude: 2 } });

    expect(page().coordinates()).toBeNull();
    expect(page().state()).toBe('addressPending');
  });

  it.each<[LocationFailureReason, string]>([
    ['permissionDenied', 'permiso'],
    ['positionUnavailable', 'No pudimos determinar'],
    ['timeout', 'demasiado tiempo'],
    ['unsupported', 'no ofrece geolocalización']
  ])('%s deja disponible la dirección escrita', (reason, text) => {
    create('TENANT');
    getCurrentLocation.mockReturnValue(of<LocationResult>({ status: 'failure', reason }));

    clickUseLocation();

    expect(page().state()).toBe('locationError');
    expect(status()).toContain(text);
    expect(el('#search-address').disabled).toBe(false);
    expect(el('#use-my-location').disabled).toBe(false);
    expect(el('#search-submit').disabled).toBe(false);

    typeAddress('Calle 1');
    expect(page().state()).toBe('addressPending');
  });
});

describe('Ruta /properties/search y navegación (FR-UC-06)', () => {
  const privateRoute = routes.find((r) => r.children && r.canActivate);
  const route = privateRoute?.children?.find((c) => c.path === 'properties/search');

  function canActivate(role: Role): boolean {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const store = TestBed.inject(CurrentUserStore);
    store.setRoles([role]);
    store.setActiveRole(role);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    return TestBed.runInInjectionContext(() =>
      roleGuard({ data: route?.data } as unknown as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    ) as boolean;
  }

  it('está dentro del shell privado, protegida por roleGuard, solo para OWNER y TENANT', () => {
    expect(route).toBeDefined();
    expect(route?.canActivate).toContain(roleGuard);
    expect(route?.data?.['roles']).toEqual(['OWNER', 'TENANT']);
  });

  it('carga PropertySearchComponent', async () => {
    const component = await (route?.loadComponent as () => Promise<unknown>)();
    expect(component).toBe(PropertySearchComponent);
  });

  it.each<Role>(['OWNER', 'TENANT'])('%s puede acceder', (role) => {
    expect(canActivate(role)).toBe(true);
  });

  it.each<Role>(['FIXER', 'REAL_ESTATE_MANAGER'])('%s no puede acceder', (role) => {
    expect(canActivate(role)).toBe(false);
  });
});
