import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { TopbarComponent } from './topbar.component';

describe('TopbarComponent', () => {
  let component: TopbarComponent;
  let fixture: ComponentFixture<TopbarComponent>;
  let userStore: CurrentUserStore;
  let logout: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    logout = vi.fn(() => of(void 0));
    await TestBed.configureTestingModule({
      imports: [TopbarComponent],
      providers: [
        CurrentUserStore,
        provideRouter([]),
        { provide: AuthService, useValue: { logout } }
      ]
    }).compileComponents();

    userStore = TestBed.inject(CurrentUserStore);
    fixture = TestBed.createComponent(TopbarComponent);
    component = fixture.componentInstance;
  });

  function setRole(role: 'OWNER' | 'FIXER' | 'TENANT' | 'REAL_ESTATE_MANAGER' | 'PLATFORM_ADMIN'): HTMLElement {
    userStore.setRoles([role]);
    userStore.setActiveRole(role);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('muestra Nueva Solicitud para OWNER con enlace a /requests', () => {
    const element = setRole('OWNER');
    expect(component.canCreateRequest()).toBe(true);
    const link = Array.from(element.querySelectorAll('a')).find((item) =>
      item.textContent?.includes('Nueva Solicitud')
    );
    expect(link?.getAttribute('href')).toBe('/requests');
  });

  it('no muestra Nueva Solicitud para FIXER', () => {
    const element = setRole('FIXER');
    expect(component.canCreateRequest()).toBe(false);
    expect(element.textContent).not.toContain('Nueva Solicitud');
  });

  it.each(['TENANT', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN'] as const)(
    'no muestra Nueva Solicitud para %s',
    (role) => {
      const element = setRole(role);
      expect(component.canCreateRequest()).toBe(false);
      expect(element.textContent).not.toContain('Nueva Solicitud');
    }
  );

  it('no renderiza búsqueda ni notificaciones ficticias', () => {
    const element = setRole('OWNER');
    expect(element.querySelector('input')).toBeNull();
    expect(element.querySelector('[role="search"]')).toBeNull();
    expect(element.querySelector('[aria-label="Notificaciones"]')).toBeNull();
    expect(element.querySelector('.notification-badge')).toBeNull();
  });

  it('mantiene el perfil accesible y ejecuta logout', () => {
    const element = setRole('OWNER');
    const profile = element.querySelector('.user-profile-chip') as HTMLAnchorElement;
    expect(profile.getAttribute('href')).toBe('/profile');

    (element.querySelector('.btn-logout') as HTMLButtonElement).click();
    expect(logout).toHaveBeenCalledOnce();
  });
});
