import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Auth0ClientService, AuthService as Auth0Service } from '@auth0/auth0-angular';
import { provideFixUpAuth } from '../auth/auth.config';
import { of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DEMO_ACCOUNTS, DemoSession } from './demo-session';
import { fixupAuthInterceptor } from './fixup-auth.interceptor';

describe('sesión de demostración', () => {
  let session: DemoSession;
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideFixUpAuth(),
        { provide: Auth0ClientService, useValue: { getTokenSilently: () => Promise.resolve('auth0-token') } },
        provideHttpClient(withInterceptors([fixupAuthInterceptor])),
        provideHttpClientTesting(),
        { provide: Auth0Service, useValue: { isLoading$: of(false), getAccessTokenSilently: () => of('auth0-token') } }
      ]
    });
    session = TestBed.inject(DemoSession);
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    sessionStorage.clear();
  });

  it('pide el token al backend local con el subject de la cuenta protagonista', () => {
    const owner = DEMO_ACCOUNTS.find((a) => a.role === 'OWNER')!;
    let started = false;
    session.start(owner).subscribe(() => (started = true));

    const request = backend.expectOne((r) => r.url === `${environment.apiOrigin}/demo/token`);
    expect(request.request.params.get('sub')).toBe('auth0|demo-owner');
    expect(request.request.params.get('role')).toBe('OWNER');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ accessToken: 'demo-token', ttlSeconds: 3600 });

    expect(started).toBe(true);
    expect(session.token).toBe('demo-token');
    expect(JSON.parse(sessionStorage.getItem('fixrent.demo-session')!).subject).toBe('auth0|demo-owner');
  });

  it('el interceptor adjunta el token demo solo a la API de Fix&Rent', () => {
    session.start(DEMO_ACCOUNTS[0]).subscribe();
    backend.expectOne((r) => r.url.endsWith('/demo/token')).flush({ accessToken: 'demo-token', ttlSeconds: 3600 });

    http.get(`${environment.apiOrigin}/visits?requestId=abc`).subscribe();
    const api = backend.expectOne(`${environment.apiOrigin}/visits?requestId=abc`);
    expect(api.request.headers.get('Authorization')).toBe('Bearer demo-token');
    api.flush([]);

    http.get('https://tile.openstreetmap.org/1/1/1.png').subscribe();
    const external = backend.expectOne('https://tile.openstreetmap.org/1/1/1.png');
    expect(external.request.headers.has('Authorization')).toBe(false);
    external.flush('');
  });

  it('al terminar la sesión olvida el token', () => {
    session.start(DEMO_ACCOUNTS[2]).subscribe();
    backend.expectOne((r) => r.url.endsWith('/demo/token')).flush({ accessToken: 'demo-token', ttlSeconds: 3600 });
    session.end();
    expect(session.token).toBeNull();
    expect(sessionStorage.getItem('fixrent.demo-session')).toBeNull();
  });
});
