import { HttpErrorResponse, HttpHeaders, HttpResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { LocationControllerService, PropertyControllerService, PropertySearchResult } from '../../../../api/generated';
import { routes } from '../../../../app.routes';
import { Role } from '../../../../core/auth/auth.types';
import { CurrentUserStore } from '../../../../core/auth/current-user.store';
import { roleGuard } from '../../../../core/auth/role.guard';
import { LocationFailureReason, LocationResult } from '../../models/location.models';
import { GeocodingCandidate } from '../../models/geocoding.models';
import { MAP_TILE_CONFIG } from '../../services/tile-provider.config';
import { LocationService } from '../../services/location.service';
import { PropertySearchStore } from '../../services/property-search.store';
import { GeocodingStore } from '../../services/geocoding.store';
import { PropertySearchComponent } from './property-search.component';

describe('PropertySearchComponent (FR-UC-06)', () => {
  let fixture: ComponentFixture<PropertySearchComponent>;
  let host: HTMLElement;
  let httpTesting: HttpTestingController;
  let getCurrentLocation: ReturnType<typeof vi.fn>;
  let searchApiSpy: ReturnType<typeof vi.fn>;
  let geocodeApiSpy: ReturnType<typeof vi.fn>;

  const gpsSuccess = of<LocationResult>({
    status: 'success',
    coordinates: { latitude: 4.65, longitude: -74.05 }
  });

  const mockApiResults: PropertySearchResult[] = [
    {
      id: 'prop-101',
      name: 'Apartamento Chapinero Central',
      address: 'Cra 7 # 53-10',
      city: 'Bogotá',
      areaM2: 70,
      latitude: 4.651,
      longitude: -74.052,
      distanceKm: 0.15,
      ownedByCurrentUser: false
    },
    {
      id: 'prop-102',
      name: 'Oficina El Poblado',
      address: 'Calle 10 # 43-20',
      city: 'Medellín',
      areaM2: 120,
      latitude: 4.66,
      longitude: -74.04,
      distanceKm: 1.2,
      ownedByCurrentUser: true
    }
  ];

  const mockGeocodingCandidates: GeocodingCandidate[] = [
    { displayName: 'Carrera 7 # 53-10, Bogotá', latitude: 4.651, longitude: -74.052 },
    { displayName: 'Carrera 7 # 100-20, Bogotá', latitude: 4.685, longitude: -74.032 }
  ];

  beforeEach(() => {
    getCurrentLocation = vi.fn();
    searchApiSpy = vi.fn().mockReturnValue(of([]));
    geocodeApiSpy = vi.fn().mockReturnValue(of(new HttpResponse({ body: [] })));

    TestBed.configureTestingModule({
      imports: [PropertySearchComponent],
      providers: [
        { provide: LocationService, useValue: { getCurrentLocation } },
        { provide: PropertyControllerService, useValue: { search: searchApiSpy } },
        { provide: LocationControllerService, useValue: { geocode: geocodeApiSpy } },
        {
          provide: MAP_TILE_CONFIG,
          useValue: {
            tileUrl: 'https://example.com/tiles/{z}/{x}/{y}.png',
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18
          }
        },
        PropertySearchStore,
        GeocodingStore,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // La infraestructura HTTP directa no debe usarse fuera del cliente generado
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

  function clickResolveAddress(): void {
    el('#resolve-address').click();
    fixture.detectChanges();
  }

  function clickSearch(): void {
    el('#search-submit').click();
    fixture.detectChanges();
  }

  it('no muestra latitud ni longitud y sí un campo de dirección y botón Buscar dirección', () => {
    create('TENANT');

    expect(el('#search-latitude')).toBeNull();
    expect(el('#search-longitude')).toBeNull();
    expect(el('#search-address')).not.toBeNull();
    expect(el('#resolve-address')).not.toBeNull();
    expect(host.querySelector('h1')?.textContent).toContain('Explorar inmuebles');
  });

  it('muestra tarjeta de estado inicial con guía de uso sin dejar espacio vacío desproporcionado', () => {
    create('TENANT');
    const initialCard = host.querySelector('#property-search-initial');
    expect(initialCard).not.toBeNull();
    expect(initialCard?.textContent).toContain('Explora inmuebles cercanos');
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

  it('con GPS listo "Buscar propiedades" llama al store con coordenadas, radio y ALL (TENANT)', () => {
    create('TENANT');
    getCurrentLocation.mockReturnValue(gpsSuccess);
    clickUseLocation();

    clickSearch();

    expect(page().searchParameters()).toEqual({
      latitude: 4.65,
      longitude: -74.05,
      radiusKm: 5
    });
    expect(page().searchStore.lastParams()).toEqual({
      latitude: 4.65,
      longitude: -74.05,
      radiusKm: 5,
      ownershipScope: 'ALL'
    });
    expect(searchApiSpy).toHaveBeenCalledWith('4.65', '-74.05', '5', 'ALL');
    expect(host.querySelector('#search-parameters')?.textContent).toContain('ubicación actual');
    expect(host.querySelector('#search-parameters')?.textContent).toContain('radio 5 km');
    expect(page().locationRequired()).toBe(false);
  });

  it.each([
    ['#ownership-all', 'ALL'],
    ['#ownership-mine', 'MINE'],
    ['#ownership-others', 'OTHERS']
  ])('OWNER envía el alcance elegido (%s) al store', (selector, expected) => {
    create('OWNER');
    getCurrentLocation.mockReturnValue(gpsSuccess);
    clickUseLocation();
    el(selector).click();
    fixture.detectChanges();

    clickSearch();

    expect(page().searchParameters()?.ownership).toBe(expected);
    expect(page().searchStore.lastParams()?.ownershipScope).toBe(expected);
    expect(searchApiSpy).toHaveBeenCalledWith('4.65', '-74.05', '5', expected);
  });

  it('OWNER ve Todos / Mis inmuebles / Otros inmuebles', () => {
    create('OWNER');

    const labels = Array.from(host.querySelectorAll('#search-ownership label')).map((l) =>
      l.textContent?.trim()
    );
    expect(labels).toEqual(['Todos', 'Mis inmuebles', 'Otros inmuebles']);
  });

  it('TENANT no ve el filtro de alcance y siempre envía ALL', () => {
    create('TENANT');
    getCurrentLocation.mockReturnValue(gpsSuccess);
    clickUseLocation();

    expect(el('#search-ownership')).toBeNull();
    expect(host.textContent).not.toContain('Otros inmuebles');

    clickSearch();
    expect(searchApiSpy).toHaveBeenCalledWith('4.65', '-74.05', '5', 'ALL');
  });

  it('una dirección escrita queda pendiente y no genera coordenadas', () => {
    create('TENANT');

    typeAddress('Calle 10 # 20-30');

    expect(page().state()).toBe('addressPending');
    expect(page().locationSource()).toBe('address');
    expect(page().coordinates()).toBeNull();
    expect(status()).toContain('Aún no se ha convertido');
  });

  it('escribir en el campo de dirección NO llama al backend (sin autocomplete)', () => {
    create('TENANT');

    typeAddress('Carrera 7');

    expect(geocodeApiSpy).not.toHaveBeenCalled();
    expect(searchApiSpy).not.toHaveBeenCalled();
  });

  it('pulsar "Buscar dirección" llama al backend con la query recortada', () => {
    create('TENANT');
    geocodeApiSpy.mockReturnValue(of(new HttpResponse({ body: mockGeocodingCandidates })));

    typeAddress('  Carrera 7 # 53-10  ');
    clickResolveAddress();

    expect(geocodeApiSpy).toHaveBeenCalledWith('Carrera 7 # 53-10', 'response');
  });

  it('recibir candidatos muestra sus displayName sin seleccionar automáticamente el primero', () => {
    create('TENANT');
    const headers = new HttpHeaders({ 'X-Data-Attribution': '© OpenStreetMap contributors' });
    geocodeApiSpy.mockReturnValue(of(new HttpResponse({ body: mockGeocodingCandidates, headers })));

    typeAddress('Carrera 7');
    clickResolveAddress();

    const candidateButtons = host.querySelectorAll('.candidate-option');
    expect(candidateButtons.length).toBe(2);
    expect(candidateButtons[0].textContent).toContain('Carrera 7 # 53-10, Bogotá');
    expect(candidateButtons[1].textContent).toContain('Carrera 7 # 100-20, Bogotá');
    expect(host.querySelector('#geocoding-attribution')?.textContent).toContain('© OpenStreetMap contributors');

    // No se seleccionan coordenadas automáticamente
    expect(page().coordinates()).toBeNull();
    expect(page().state()).toBe('addressPending');
  });

  it('seleccionar explícitamente un candidato fija coordenadas internas y habilita la búsqueda de propiedades', () => {
    create('TENANT');
    geocodeApiSpy.mockReturnValue(of(new HttpResponse({ body: mockGeocodingCandidates })));

    typeAddress('Carrera 7');
    clickResolveAddress();

    // El usuario selecciona el segundo candidato
    const candidateButtons = host.querySelectorAll('.candidate-option');
    (candidateButtons[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(page().coordinates()).toEqual({ latitude: 4.685, longitude: -74.032 });
    expect(page().locationSource()).toBe('address');
    expect(page().state()).toBe('locationReady');
    expect(status()).toContain('Usando la dirección seleccionada');
    expect(host.textContent).not.toContain('4.685');
    expect(host.textContent).not.toContain('-74.032');

    // Ahora busca propiedades con las coordenadas del candidato seleccionado
    clickSearch();

    expect(searchApiSpy).toHaveBeenCalledWith('4.685', '-74.032', '5', 'ALL');
    expect(host.querySelector('#search-parameters')?.textContent).toContain('dirección indicada');
  });

  it('editar el texto de dirección después de seleccionar un candidato invalida inmediatamente las coordenadas', () => {
    create('TENANT');
    geocodeApiSpy.mockReturnValue(of(new HttpResponse({ body: mockGeocodingCandidates })));

    typeAddress('Carrera 7');
    clickResolveAddress();
    const candidateButtons = host.querySelectorAll('.candidate-option');
    (candidateButtons[0] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(page().coordinates()).not.toBeNull();

    // El usuario modifica el texto de la dirección
    typeAddress('Carrera 7 bis');

    expect(page().coordinates()).toBeNull();
    expect(page().state()).toBe('addressPending');

    // Intentar buscar propiedades queda bloqueado
    clickSearch();
    expect(searchApiSpy).not.toHaveBeenCalled();
    expect(page().searchParameters()).toBeNull();
    expect(host.querySelector('#search-hint')?.textContent).toContain('Selecciona una ubicación válida');
  });

  it('muestra mensaje informativo cuando la geocodificación no encuentra ubicaciones (empty)', () => {
    create('TENANT');
    geocodeApiSpy.mockReturnValue(of(new HttpResponse({ body: [] })));

    typeAddress('DireccionInexistente123');
    clickResolveAddress();

    expect(host.querySelector('#geocoding-empty')?.textContent).toContain(
      'No encontramos ubicaciones para esa dirección'
    );
    expect(page().coordinates()).toBeNull();
  });

  it('maneja error 400 en geocodificación con mensaje de entrada inválida', () => {
    create('TENANT');
    geocodeApiSpy.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400 })));

    typeAddress('???');
    clickResolveAddress();

    const errorBlock = host.querySelector('#geocoding-error');
    expect(errorBlock).not.toBeNull();
    expect(errorBlock?.textContent).toContain('La dirección ingresada no es válida');
  });

  it('maneja error 429 en geocodificación con mensaje de límite de peticiones y botón de reintento', () => {
    create('TENANT');
    geocodeApiSpy.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 429 })));

    typeAddress('Calle 100');
    clickResolveAddress();

    const errorBlock = host.querySelector('#geocoding-error');
    expect(errorBlock).not.toBeNull();
    expect(errorBlock?.textContent).toContain('Temporalmente no se pueden realizar nuevas búsquedas');

    // Reintento exitoso
    geocodeApiSpy.mockReturnValue(of(new HttpResponse({ body: mockGeocodingCandidates })));
    const retryBtn = host.querySelector('#geocoding-retry') as HTMLButtonElement;
    expect(retryBtn).not.toBeNull();
    retryBtn.click();
    fixture.detectChanges();

    expect(geocodeApiSpy).toHaveBeenCalledTimes(2);
    expect(host.querySelectorAll('.candidate-option').length).toBe(2);
  });

  it('maneja error 503 en geocodificación indicando indisponibilidad del servicio', () => {
    create('TENANT');
    geocodeApiSpy.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));

    typeAddress('Calle 80');
    clickResolveAddress();

    const errorBlock = host.querySelector('#geocoding-error');
    expect(errorBlock).not.toBeNull();
    expect(errorBlock?.textContent).toContain('El servicio de ubicación por dirección está temporalmente no disponible');
  });

  it('un error en geocodificación no rompe la búsqueda por GPS', () => {
    create('TENANT');
    geocodeApiSpy.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));

    typeAddress('Calle 80');
    clickResolveAddress();
    expect(host.querySelector('#geocoding-error')).not.toBeNull();

    // El usuario pulsa GPS inmediatamente después
    getCurrentLocation.mockReturnValue(gpsSuccess);
    clickUseLocation();

    expect(page().state()).toBe('locationReady');
    expect(page().locationSource()).toBe('gps');
    expect(page().coordinates()).toEqual({ latitude: 4.65, longitude: -74.05 });

    clickSearch();
    expect(searchApiSpy).toHaveBeenCalledWith('4.65', '-74.05', '5', 'ALL');
  });

  it('un error en GPS no rompe la geocodificación por dirección', () => {
    create('TENANT');
    getCurrentLocation.mockReturnValue(of<LocationResult>({ status: 'failure', reason: 'permissionDenied' }));

    clickUseLocation();
    expect(page().state()).toBe('locationError');
    expect(status()).toContain('No tenemos permiso');

    // El usuario resuelve una dirección
    geocodeApiSpy.mockReturnValue(of(new HttpResponse({ body: mockGeocodingCandidates })));
    typeAddress('Carrera 7');
    clickResolveAddress();

    const candidateButtons = host.querySelectorAll('.candidate-option');
    expect(candidateButtons.length).toBe(2);
    (candidateButtons[0] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(page().state()).toBe('locationReady');
    expect(page().locationSource()).toBe('address');

    clickSearch();
    expect(searchApiSpy).toHaveBeenCalledWith('4.651', '-74.052', '5', 'ALL');
  });

  it('OWNER puede buscar propiedades con dirección y scopes MINE y OTHERS', () => {
    create('OWNER');
    geocodeApiSpy.mockReturnValue(of(new HttpResponse({ body: mockGeocodingCandidates })));

    typeAddress('Carrera 7');
    clickResolveAddress();
    (host.querySelector('.candidate-option') as HTMLButtonElement).click();
    fixture.detectChanges();

    el('#ownership-mine').click();
    fixture.detectChanges();
    clickSearch();

    expect(searchApiSpy).toHaveBeenCalledWith('4.651', '-74.052', '5', 'MINE');

    el('#ownership-others').click();
    fixture.detectChanges();
    clickSearch();

    expect(searchApiSpy).toHaveBeenCalledWith('4.651', '-74.052', '5', 'OTHERS');
  });

  it('buscar con una dirección sin geocodificar no llama al backend ni al store', () => {
    create('TENANT');
    typeAddress('Calle 10 # 20-30');

    clickSearch();

    expect(page().searchParameters()).toBeNull();
    expect(page().coordinates()).toBeNull();
    expect(searchApiSpy).not.toHaveBeenCalled();
    expect(host.querySelector('#search-hint')?.textContent).toContain(
      'Selecciona una ubicación válida para continuar.'
    );
    expect(host.querySelector('#search-parameters')).toBeNull();
  });

  it('buscar sin indicar nada tampoco llama al backend', () => {
    create('TENANT');

    clickSearch();

    expect(page().searchParameters()).toBeNull();
    expect(searchApiSpy).not.toHaveBeenCalled();
    expect(host.querySelector('#search-hint')).not.toBeNull();
  });

  it('escribir una dirección después del GPS descarta las coordenadas del GPS y resetea el store', () => {
    create('TENANT');
    getCurrentLocation.mockReturnValue(gpsSuccess);
    clickUseLocation();

    typeAddress('Avenida 68');

    expect(page().coordinates()).toBeNull();
    expect(page().state()).toBe('addressPending');
    expect(page().searchStore.state()).toBe('idle');
    clickSearch();
    expect(page().searchParameters()).toBeNull();
    expect(searchApiSpy).not.toHaveBeenCalled();
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

  it('renderiza mapa y listado de resultados cuando el backend responde satisfactoriamente', () => {
    searchApiSpy.mockReturnValue(of(mockApiResults));
    create('TENANT');
    getCurrentLocation.mockReturnValue(gpsSuccess);
    clickUseLocation();

    clickSearch();

    expect(page().searchStore.state()).toBe('success');
    expect(host.querySelector('#property-map-container')).not.toBeNull();
    const cards = host.querySelectorAll('.property-card');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Apartamento Chapinero Central');
    expect(cards[1].textContent).toContain('Oficina El Poblado');
  });

  it('sincroniza selección bidireccionalmente: click en tarjeta actualiza selectedPropertyId y resalta mapa', () => {
    searchApiSpy.mockReturnValue(of(mockApiResults));
    create('TENANT');
    getCurrentLocation.mockReturnValue(gpsSuccess);
    clickUseLocation();
    clickSearch();

    const cards = host.querySelectorAll('.property-card');
    (cards[1] as HTMLElement).click();
    fixture.detectChanges();

    expect(page().searchStore.selectedPropertyId()).toBe('prop-102');
    expect(cards[1].classList.contains('is-selected')).toBe(true);
    expect(cards[0].classList.contains('is-selected')).toBe(false);
  });

  it('sincroniza selección bidireccionalmente: seleccionar propiedad desde el mapa actualiza la lista', () => {
    searchApiSpy.mockReturnValue(of(mockApiResults));
    create('TENANT');
    getCurrentLocation.mockReturnValue(gpsSuccess);
    clickUseLocation();
    clickSearch();

    // Seleccionar mediante store (equivalente a evento de marcador del mapa)
    page().onPropertySelected(mockApiResults[0]);
    fixture.detectChanges();

    expect(page().searchStore.selectedPropertyId()).toBe('prop-101');
    const cards = host.querySelectorAll('.property-card');
    expect(cards[0].classList.contains('is-selected')).toBe(true);
    expect(cards[1].classList.contains('is-selected')).toBe(false);
  });

  it('modo degradado: si el mapa falla, se muestra aviso y el listado sigue completo y funcional', () => {
    // Reconfigurar con simulateFailure: true en MAP_TILE_CONFIG
    TestBed.resetTestingModule();
    getCurrentLocation = vi.fn().mockReturnValue(gpsSuccess);
    searchApiSpy = vi.fn().mockReturnValue(of(mockApiResults));
    geocodeApiSpy = vi.fn().mockReturnValue(of(new HttpResponse({ body: [] })));

    TestBed.configureTestingModule({
      imports: [PropertySearchComponent],
      providers: [
        { provide: LocationService, useValue: { getCurrentLocation } },
        { provide: PropertyControllerService, useValue: { search: searchApiSpy } },
        { provide: LocationControllerService, useValue: { geocode: geocodeApiSpy } },
        {
          provide: MAP_TILE_CONFIG,
          useValue: {
            tileUrl: 'https://example.com/tiles/{z}/{x}/{y}.png',
            attribution: '© OpenStreetMap contributors',
            maxZoom: 18,
            simulateFailure: true
          }
        },
        PropertySearchStore,
        GeocodingStore,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    create('TENANT');
    clickUseLocation();
    clickSearch();

    // El aviso de mapa no disponible está en el DOM
    expect(host.querySelector('#map-degraded-state')).not.toBeNull();
    expect(host.querySelector('#map-degraded-state')?.textContent).toContain(
      'El mapa no está disponible temporalmente'
    );

    // El listado sigue completamente visible y funcional
    const cards = host.querySelectorAll('.property-card');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('Apartamento Chapinero Central');

    // Se puede interactuar con el listado normalmente
    (cards[0] as HTMLElement).click();
    fixture.detectChanges();
    expect(page().searchStore.selectedPropertyId()).toBe('prop-101');
    expect(cards[0].classList.contains('is-selected')).toBe(true);
  });

  it('muestra estado vacío cuando el backend devuelve 0 resultados', () => {
    searchApiSpy.mockReturnValue(of([]));
    create('TENANT');
    getCurrentLocation.mockReturnValue(gpsSuccess);
    clickUseLocation();

    clickSearch();

    expect(page().searchStore.state()).toBe('empty');
    expect(host.querySelector('#property-empty-state')?.textContent).toContain(
      'No encontramos inmuebles dentro de este radio.'
    );
  });

  it('muestra bloque de error y botón de reintentar si el backend falla', () => {
    searchApiSpy.mockReturnValue(throwError(() => new Error('Error al conectar con el servidor')));
    create('TENANT');
    getCurrentLocation.mockReturnValue(gpsSuccess);
    clickUseLocation();

    clickSearch();

    expect(page().searchStore.state()).toBe('apiError');
    const errorBlock = host.querySelector('#api-error');
    expect(errorBlock).not.toBeNull();
    expect(errorBlock?.textContent).toContain('Error al conectar con el servidor');

    const retryBtn = host.querySelector('#search-retry') as HTMLButtonElement;
    expect(retryBtn).not.toBeNull();

    searchApiSpy.mockReturnValue(of(mockApiResults));
    retryBtn.click();
    fixture.detectChanges();

    expect(page().searchStore.state()).toBe('success');
    expect(host.querySelectorAll('.property-card').length).toBe(2);
  });

  it('cambio de radio con coordenadas listas dispara refetch inmediato al backend con el nuevo radio', () => {
    searchApiSpy.mockReturnValue(of(mockApiResults));
    create('TENANT');
    getCurrentLocation.mockReturnValue(gpsSuccess);
    clickUseLocation();
    clickSearch();

    expect(searchApiSpy).toHaveBeenCalledWith('4.65', '-74.05', '5', 'ALL');

    // Cambiar el radio a 10 km
    const radiusSelect = host.querySelector('#search-radius') as HTMLSelectElement;
    radiusSelect.selectedIndex = 3; // 10 km
    radiusSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(searchApiSpy).toHaveBeenCalledWith('4.65', '-74.05', '10', 'ALL');
    expect(page().searchParameters()?.radiusKm).toBe(10);
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
