import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthApiService } from '../../api/auth-api.service';
import { apiUrl, API_ROUTES } from '../../api/api.routes';
import { BootstrapResponse, RolesResponse, UserResponse } from './auth.types';

describe('AuthApiService', () => {
  let service: AuthApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AuthApiService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(AuthApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('debe enviar una petición POST a /auth/bootstrap con un cuerpo vacío {}', () => {
    const mockResponse: BootstrapResponse = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@fixup.com',
      displayName: 'Test User',
      status: 'ACTIVE',
      roles: ['OWNER']
    };

    service.bootstrap().subscribe((res) => {
      expect(res).toEqual(mockResponse);
    });

    const req = httpTesting.expectOne(apiUrl(API_ROUTES.auth.bootstrap));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(mockResponse);
  });

  it('debe consultar el perfil de usuario actual con GET en /auth/me', () => {
    const mockUser: UserResponse = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      email: 'test@fixup.com',
      displayName: 'Test User',
      status: 'ACTIVE',
      roles: ['OWNER']
    };

    service.getMe().subscribe((res) => {
      expect(res).toEqual(mockUser);
    });

    const req = httpTesting.expectOne(apiUrl(API_ROUTES.auth.me));
    expect(req.request.method).toBe('GET');
    req.flush(mockUser);
  });

  it('debe enviar la selección inicial mediante POST a /auth/select-role con el rol permitido', () => {
    const mockRoles: RolesResponse = {
      roles: ['TENANT']
    };

    service.selectInitialRole('TENANT').subscribe((res) => {
      expect(res).toEqual(mockRoles);
    });

    const req = httpTesting.expectOne(apiUrl(API_ROUTES.auth.selectRole));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ role: 'TENANT' });
    req.flush(mockRoles);
  });
});
