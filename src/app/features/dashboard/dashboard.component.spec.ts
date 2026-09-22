import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { FixerVerificationStore } from '../fixers/pages/verification/fixer-verification.store';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let userStore: CurrentUserStore;
  let verificationStore: FixerVerificationStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [CurrentUserStore, provideRouter([])]
    }).compileComponents();
    userStore = TestBed.inject(CurrentUserStore);
    verificationStore = TestBed.inject(FixerVerificationStore);
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  function render(role: 'OWNER' | 'FIXER' | 'PLATFORM_ADMIN' | 'TENANT' | 'REAL_ESTATE_MANAGER', status: 'ACTIVE' | 'PENDING' = 'ACTIVE'): HTMLElement {
    userStore.setProfile({ id: 'user-1', email: 'user@fixup.com', displayName: 'Alex FixUp', status, roles: [role] });
    userStore.setActiveRole(role);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function paths(element: HTMLElement): string[] {
    return Array.from(element.querySelectorAll('a')).map((link) => link.getAttribute('href') ?? '');
  }

  it('mantiene saludo, rol y estado real', () => {
    const element = render('FIXER', 'PENDING');
    expect(element.querySelector('.greeting-title')?.textContent).toContain('Alex FixUp');
    expect(element.querySelector('.role-badge')?.textContent).toContain('Técnico Fixer');
    expect(element.querySelector('.status-badge')?.textContent).toContain('Cuenta en proceso de validación');
  });

  it('muestra las acciones OWNER y excluye placeholder y acciones FIXER', () => {
    const element = render('OWNER');
    const links = paths(element);
    expect(links).toContain('/properties');
    expect(links).toContain('/requests');
    expect(element.textContent).toContain('Nueva reparación');
    expect(links).not.toContain('/fixers');
    expect(links).not.toContain('/requests/inbox');
    expect(links).not.toContain('/jobs/me');
  });

  it('limita al FIXER no verificado y muestra el CTA de verificación', () => {
    const element = render('FIXER');
    const links = paths(element);
    expect(element.textContent).toContain('Completa tu verificación');
    expect(links).toContain('/fixers/verification');
    expect(links).toContain('/quotations/me');
    expect(links).toContain('/jobs/me');
    expect(links).toContain('/payments/earnings');
    expect(links).not.toContain('/requests/inbox');
    expect(links).not.toContain('/fixers/portfolio');
  });

  it('restaura todas las acciones profesionales para FIXER verificado', () => {
    vi.spyOn(verificationStore, 'verified').mockReturnValue(true);
    const links = paths(render('FIXER'));
    expect(links).toEqual(expect.arrayContaining([
      '/requests/inbox', '/quotations/me', '/jobs/me', '/payments/earnings',
      '/fixers/verification', '/fixers/portfolio', '/profile'
    ]));
  });

  it('limita PLATFORM_ADMIN a revisi�n y perfil', () => {
    const links = paths(render('PLATFORM_ADMIN'));
    expect(links).toEqual(['/administration/fixer-review', '/profile']);
    expect(links).not.toContain('/properties');
    expect(links).not.toContain('/requests');
    expect(links).not.toContain('/jobs/me');
  });

  it('muestra solicitudes y perfil para TENANT sin capacidades OWNER o FIXER', () => {
    const element = render('TENANT');
    const links = paths(element);
    expect(links).toEqual(['/requests', '/profile']);
    expect(element.textContent).toContain('Consulta las solicitudes asociadas a tu cuenta.');
    expect(links).not.toContain('/properties');
    expect(links).not.toContain('/requests/inbox');
    expect(links).not.toContain('/jobs/me');
  });

  it('muestra solicitudes y perfil para REAL_ESTATE_MANAGER sin capacidades OWNER o FIXER', () => {
    const element = render('REAL_ESTATE_MANAGER');
    const links = paths(element);
    expect(links).toEqual(['/requests', '/profile']);
    expect(element.textContent).toContain('Consulta las solicitudes asociadas a tu cuenta.');
    expect(links).not.toContain('/properties');
    expect(links).not.toContain('/requests/inbox');
    expect(links).not.toContain('/jobs/me');
  });

  it('no renderiza cifras ni KPI ficticios anteriores', () => {
    const text = render('OWNER').textContent ?? '';
    expect(text).not.toContain('4 inmuebles');
    expect(text).not.toContain('8 activas');
    expect(text).not.toContain('4.95');
    expect(text).not.toContain('12 enviados');
    expect(text).not.toContain('85%');
    expect(text).not.toContain('14 t�cnicos');
    expect(fixture.nativeElement.querySelector('.kpi-card')).toBeNull();
  });
});
