import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let userStore: CurrentUserStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [CurrentUserStore, provideRouter([])]
    }).compileComponents();
    userStore = TestBed.inject(CurrentUserStore);
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

  it('muestra todas las acciones reales del FIXER y excluye propiedades', () => {
    const links = paths(render('FIXER'));
    expect(links).toEqual(expect.arrayContaining([
      '/requests/inbox', '/quotations/me', '/jobs/me', '/payments/earnings',
      '/fixers/verification', '/fixers/portfolio', '/profile'
    ]));
    expect(links).not.toContain('/properties');
  });

  it('limita PLATFORM_ADMIN a revisión y perfil', () => {
    const links = paths(render('PLATFORM_ADMIN'));
    expect(links).toEqual(['/administration/fixer-review', '/profile']);
    expect(links).not.toContain('/properties');
    expect(links).not.toContain('/requests');
    expect(links).not.toContain('/jobs/me');
  });

  it('limita TENANT a perfil sin capacidades OWNER o FIXER', () => {
    const links = paths(render('TENANT'));
    expect(links).toEqual(['/profile']);
    expect(links).not.toContain('/properties');
    expect(links).not.toContain('/requests');
  });

  it('limita REAL_ESTATE_MANAGER a perfil', () => {
    const links = paths(render('REAL_ESTATE_MANAGER'));
    expect(links).toEqual(['/profile']);
    expect(links).not.toContain('/properties');
    expect(links).not.toContain('/requests');
  });

  it('no renderiza cifras ni KPI ficticios anteriores', () => {
    const text = render('OWNER').textContent ?? '';
    expect(text).not.toContain('4 inmuebles');
    expect(text).not.toContain('8 activas');
    expect(text).not.toContain('4.95');
    expect(text).not.toContain('12 enviados');
    expect(text).not.toContain('85%');
    expect(text).not.toContain('14 técnicos');
    expect(fixture.nativeElement.querySelector('.kpi-card')).toBeNull();
  });
});
