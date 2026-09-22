import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { BottomNavigationComponent } from './bottom-navigation.component';

describe('BottomNavigationComponent', () => {
  let component: BottomNavigationComponent;
  let fixture: ComponentFixture<BottomNavigationComponent>;
  let userStore: CurrentUserStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BottomNavigationComponent],
      providers: [
        CurrentUserStore,
        provideRouter([])
      ]
    }).compileComponents();

    userStore = TestBed.inject(CurrentUserStore);
    fixture = TestBed.createComponent(BottomNavigationComponent);
    component = fixture.componentInstance;
  });

  function pathsFor(role: 'OWNER' | 'FIXER' | 'PLATFORM_ADMIN' | 'TENANT' | 'REAL_ESTATE_MANAGER'): string[] {
    userStore.setRoles([role]);
    userStore.setActiveRole(role);
    fixture.detectChanges();
    return component.visibleItems().map((item) => item.path);
  }

  it('muestra dashboard, propiedades, solicitudes y perfil para OWNER', () => {
    expect(pathsFor('OWNER')).toEqual(['/dashboard', '/properties', '/requests', '/profile']);
  });

  it('limita el bottom nav FIXER a sus cuatro elementos primarios', () => {
    const paths = pathsFor('FIXER');
    expect(paths).toEqual(['/dashboard', '/requests/inbox', '/jobs/me', '/profile']);
    expect(paths).not.toContain('/quotations/me');
    expect(paths).not.toContain('/payments/earnings');
    expect(paths).not.toContain('/fixers/verification');
    expect(paths).not.toContain('/fixers/portfolio');
  });

  it('muestra dashboard, revisión y perfil para PLATFORM_ADMIN', () => {
    expect(pathsFor('PLATFORM_ADMIN')).toEqual([
      '/dashboard', '/administration/fixer-review', '/profile'
    ]);
  });

  it('limita TENANT y REAL_ESTATE_MANAGER a dashboard y perfil', () => {
    expect(pathsFor('TENANT')).toEqual(['/dashboard', '/profile']);
    expect(pathsFor('REAL_ESTATE_MANAGER')).toEqual(['/dashboard', '/profile']);
  });

  it('no muestra elementos sin rol activo', () => {
    userStore.clear();
    fixture.detectChanges();
    expect(component.visibleItems()).toEqual([]);
  });
});
