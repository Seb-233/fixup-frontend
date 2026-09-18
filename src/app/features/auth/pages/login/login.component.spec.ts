import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Observable, of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../../core/auth/auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent (Requerimientos 3, 5, 6 y 16)', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authServiceMock: {
    isLoading$: Observable<boolean>;
    loginWithRedirect: ReturnType<typeof vi.fn>;
  };
  let queryParamMapMock: Map<string, string>;

  beforeEach(async () => {
    queryParamMapMock = new Map<string, string>();

    authServiceMock = {
      isLoading$: of(false),
      loginWithRedirect: vi.fn().mockReturnValue(of(undefined))
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: authServiceMock },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) => queryParamMapMock.get(key) ?? null
              }
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
  });

  it('3. el login no debe renderizar sidebar ni elementos del layout privado', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('app-sidebar')).toBeNull();
    expect(compiled.querySelector('app-topbar')).toBeNull();
    expect(compiled.querySelector('aside')).toBeNull();
  });

  it('5. el login conserva y recupera un returnUrl interno válido', () => {
    queryParamMapMock.set('returnUrl', '/properties');
    fixture.detectChanges();

    expect(component.safeReturnUrl()).toBe('/properties');

    component.login();
    expect(authServiceMock.loginWithRedirect).toHaveBeenCalledWith('/properties');
  });

  it('6. debe rechazar returnUrl externos y sustituirlos por /dashboard', () => {
    queryParamMapMock.set('returnUrl', 'https://malicious-phishing.com');
    fixture.detectChanges();
    expect(component.safeReturnUrl()).toBe('/dashboard');

    queryParamMapMock.set('returnUrl', '//attacker.com/evil');
    fixture.detectChanges();
    expect(component.safeReturnUrl()).toBe('/dashboard');

    queryParamMapMock.set('returnUrl', 'javascript:alert(1)');
    fixture.detectChanges();
    expect(component.safeReturnUrl()).toBe('/dashboard');

    component.login();
    expect(authServiceMock.loginWithRedirect).toHaveBeenCalledWith('/dashboard');
  });

  it('16. si Auth0 devuelve un error en queryParams, lo muestra como mensaje y no genera ciclos', () => {
    queryParamMapMock.set('error', 'Acceso cancelado por el usuario');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const alertBox = compiled.querySelector('.auth-error-alert');

    expect(alertBox).toBeTruthy();
    expect(alertBox?.textContent).toContain('Acceso cancelado por el usuario');
    // Verifica que no se dispara redirección automática en ngOnInit
    expect(authServiceMock.loginWithRedirect).not.toHaveBeenCalled();
  });
});
