import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { FixerVerificationStore } from '../fixers/pages/verification/fixer-verification.store';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { ContractsStore } from '../contracts/services/contracts.store';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let userStore: CurrentUserStore;
  let verificationStore: FixerVerificationStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        CurrentUserStore,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();
    userStore = TestBed.inject(CurrentUserStore);
    verificationStore = TestBed.inject(FixerVerificationStore);
    fixture = TestBed.createComponent(DashboardComponent);
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

  it('limita PLATFORM_ADMIN a panel SLA, carga masiva y perfil', () => {
    const links = paths(render('PLATFORM_ADMIN'));
    expect(links).toEqual([
      '/administration/sla-board',
      '/administration/properties/bulk-upload',
      '/profile'
    ]);
    expect(links).not.toContain('/properties');
    expect(links).not.toContain('/requests');
    expect(links).not.toContain('/jobs/me');
  });

  it('muestra solicitudes, contratos y perfil para TENANT sin capacidades OWNER o FIXER', () => {
    const element = render('TENANT');
    const links = paths(element);
    expect(links).toEqual(['/requests', '/contracts', '/profile']);
    expect(element.textContent).toContain('Consulta las solicitudes asociadas a tu cuenta.');
    expect(links).not.toContain('/properties');
    expect(links).not.toContain('/requests/inbox');
    expect(links).not.toContain('/jobs/me');
  });

  it('muestra propiedades, carga masiva, contratos, solicitudes y perfil para REAL_ESTATE_MANAGER', () => {
    const element = render('REAL_ESTATE_MANAGER');
    const links = paths(element);
    expect(links).toEqual([
      '/properties',
      '/administration/properties/bulk-upload',
      '/contracts',
      '/requests',
      '/profile'
    ]);
    expect(element.textContent).toContain('Consulta las solicitudes asociadas a tu cuenta.');
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

  it('las tarjetas de acciones no contienen "?" ni emojis y renderizan iconos SVG reales', () => {
    const roles: ('OWNER' | 'FIXER' | 'PLATFORM_ADMIN' | 'TENANT' | 'REAL_ESTATE_MANAGER')[] = [
      'OWNER',
      'FIXER',
      'PLATFORM_ADMIN',
      'TENANT',
      'REAL_ESTATE_MANAGER'
    ];

    roles.forEach((r) => {
      const el = render(r);
      const actionCards = el.querySelectorAll('.action-card');
      expect(actionCards.length).toBeGreaterThan(0);

      actionCards.forEach((card) => {
        const iconSpan = card.querySelector('.action-icon');
        expect(iconSpan).toBeTruthy();
        expect(iconSpan?.textContent?.trim()).toBe('');
        expect(iconSpan?.textContent).not.toContain('?');
        expect(iconSpan?.querySelector('svg')).toBeTruthy();
      });
    });
  });

  it('el widget de contratos muestra un empty state compacto sin ocupar una sección desproporcionada', () => {
    const el = render('OWNER');
    const emptyState = el.querySelector('#contracts-empty-state');
    expect(emptyState).toBeTruthy();
    expect(emptyState?.textContent).toContain('Sin contratos próximos a vencer');
    expect(el.querySelector('.placeholder-card')).toBeNull();
  });

  it('FIXER entrando al dashboard NO ejecuta GET /contracts/me ni invoca carga de contratos', () => {
    const contractsStore = TestBed.inject(ContractsStore);
    const loadSpy = vi.spyOn(contractsStore, 'load');
    const httpTesting = TestBed.inject(HttpTestingController);

    render('FIXER');

    expect(loadSpy).not.toHaveBeenCalled();
    const requests = httpTesting.match((req) => req.url.includes('/contracts/me'));
    expect(requests.length).toBe(0);
  });

  it('TENANT entrando al dashboard NO ejecuta GET /contracts/me para el widget', () => {
    const contractsStore = TestBed.inject(ContractsStore);
    const loadSpy = vi.spyOn(contractsStore, 'load');
    const httpTesting = TestBed.inject(HttpTestingController);

    render('TENANT');

    expect(loadSpy).not.toHaveBeenCalled();
    const requests = httpTesting.match((req) => req.url.includes('/contracts/me'));
    expect(requests.length).toBe(0);
  });

  it('OWNER entrando al dashboard puede cargar contratos para el widget y ejecuta GET /contracts/me', () => {
    const contractsStore = TestBed.inject(ContractsStore);
    const loadSpy = vi.spyOn(contractsStore, 'load');
    const httpTesting = TestBed.inject(HttpTestingController);

    render('OWNER');

    expect(loadSpy).toHaveBeenCalled();
    const req = httpTesting.expectOne((r) => r.url.includes('/contracts/me'));
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
