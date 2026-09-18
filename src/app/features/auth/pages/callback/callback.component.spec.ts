import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../../core/auth/auth.service';
import { CurrentUserStore } from '../../../../core/auth/current-user.store';
import { BackendUserProfile } from '../../../../core/auth/auth.types';
import { CallbackComponent } from './callback.component';

describe('CallbackComponent (Requerimientos 4 y 16)', () => {
  let component: CallbackComponent;
  let fixture: ComponentFixture<CallbackComponent>;
  let routerNavigateSpy: ReturnType<typeof vi.fn>;
  let routerNavigateByUrlSpy: ReturnType<typeof vi.fn>;
  let authServiceMock: {
    error$: Observable<Error>;
    appState$: Observable<{ target?: string } | undefined>;
    sessionReady$: Observable<BackendUserProfile | null>;
  };
  let queryParamMapMock: Map<string, string>;

  beforeEach(async () => {
    queryParamMapMock = new Map<string, string>();
    routerNavigateSpy = vi.fn();
    routerNavigateByUrlSpy = vi.fn();

    authServiceMock = {
      error$: of(new Error()),
      appState$: of({ target: '/properties' }),
      sessionReady$: of(null)
    };

    await TestBed.configureTestingModule({
      imports: [CallbackComponent],
      providers: [
        CurrentUserStore,
        { provide: AuthService, useValue: authServiceMock },
        {
          provide: Router,
          useValue: {
            navigate: routerNavigateSpy,
            navigateByUrl: routerNavigateByUrlSpy
          }
        },
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

    fixture = TestBed.createComponent(CallbackComponent);
    component = fixture.componentInstance;
  });

  it('4. el callback debe mostrar la pantalla de carga de sesión', () => {
    expect(component).toBeTruthy();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-session-loading')).toBeTruthy();
  });

  it('16. si Auth0 devuelve error_description en URL, limpia parámetros y regresa a /auth/login sin bucles', () => {
    queryParamMapMock.set('error', 'access_denied');
    queryParamMapMock.set('error_description', 'El usuario canceló la autenticación');

    fixture.detectChanges();

    expect(routerNavigateSpy).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { error: 'El usuario canceló la autenticación' },
      replaceUrl: true
    });
  });

  it('debe redirigir a /auth/select-role si el usuario no tiene roles o activeRole es null', () => {
    const mockProfile: BackendUserProfile = {
      id: 'uuid-1',
      email: 'user@fixup.com',
      displayName: 'User',
      status: 'ACTIVE',
      roles: ['OWNER']
    };
    authServiceMock.sessionReady$ = of(mockProfile);

    fixture.detectChanges();

    expect(routerNavigateSpy).toHaveBeenCalledWith(['/auth/select-role'], {
      replaceUrl: true
    });
  });

  it('debe navegar al target seguro de appState cuando activeRole está seleccionado', () => {
    const userStore = TestBed.inject(CurrentUserStore);
    userStore.setProfile({
      id: 'uuid-1',
      email: 'user@fixup.com',
      displayName: 'User',
      status: 'ACTIVE',
      roles: ['OWNER']
    });
    userStore.setActiveRole('OWNER');

    authServiceMock.sessionReady$ = of(userStore.user());
    authServiceMock.appState$ = of({ target: '/properties' });

    fixture.detectChanges();

    expect(routerNavigateByUrlSpy).toHaveBeenCalledWith('/properties', {
      replaceUrl: true
    });
  });
});
