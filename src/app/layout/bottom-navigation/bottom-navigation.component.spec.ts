import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { vi } from 'vitest';
import { FixerVerificationStore } from '../../features/fixers/pages/verification/fixer-verification.store';
import { BottomNavigationComponent } from './bottom-navigation.component';

describe('BottomNavigationComponent', () => {
  let component: BottomNavigationComponent;
  let fixture: ComponentFixture<BottomNavigationComponent>;
  let userStore: CurrentUserStore;
  let verificationStore: FixerVerificationStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BottomNavigationComponent],
      providers: [
        CurrentUserStore,
        provideRouter([])
      ]
    }).compileComponents();

    userStore = TestBed.inject(CurrentUserStore);
    verificationStore = TestBed.inject(FixerVerificationStore);
    fixture = TestBed.createComponent(BottomNavigationComponent);
    component = fixture.componentInstance;
  });

  function pathsFor(role: 'OWNER' | 'FIXER' | 'PLATFORM_ADMIN' | 'TENANT' | 'REAL_ESTATE_MANAGER'): string[] {
    userStore.setRoles([role]);
    userStore.setActiveRole(role);
    fixture.detectChanges();
    return component.visibleItems().map((item) => item.path);
  }

  it('muestra dashboard, propiedades, contratos, solicitudes y perfil para OWNER', () => {
    expect(pathsFor('OWNER')).toEqual(['/dashboard', '/properties', '/contracts', '/requests', '/profile']);
  });

  it('oculta inbox del bottom nav para FIXER no verificado', () => {
    expect(pathsFor('FIXER')).toEqual(['/dashboard', '/jobs/me', '/profile']);
  });

  it('incluye inbox del bottom nav para FIXER verificado', () => {
    vi.spyOn(verificationStore, 'verified').mockReturnValue(true);
    expect(pathsFor('FIXER')).toEqual(['/dashboard', '/requests/inbox', '/jobs/me', '/profile']);
  });

  it('muestra dashboard, panel SLA, carga masiva y perfil para PLATFORM_ADMIN', () => {
    expect(pathsFor('PLATFORM_ADMIN')).toEqual([
      '/dashboard', '/administration/sla-board', '/administration/properties/bulk-upload', '/profile'
    ]);
  });

  it('muestra dashboard, solicitudes, contratos y perfil para TENANT', () => {
    expect(pathsFor('TENANT')).toEqual(['/dashboard', '/requests', '/contracts', '/profile']);
  });

  it('muestra dashboard, herramientas y perfil para REAL_ESTATE_MANAGER', () => {
    expect(pathsFor('REAL_ESTATE_MANAGER')).toEqual([
      '/dashboard', '/properties', '/administration/properties/bulk-upload', '/contracts', '/requests', '/profile'
    ]);
  });

  it('no muestra elementos sin rol activo', () => {
    userStore.clear();
    fixture.detectChanges();
    expect(component.visibleItems()).toEqual([]);
  });
});
