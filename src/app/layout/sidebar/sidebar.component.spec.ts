import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi, afterEach, beforeEach, describe, it, expect } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { FixerVerificationStore } from '../../features/fixers/pages/verification/fixer-verification.store';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { NavigationIcon } from '../../core/navigation/role-navigation';
import { NavIconComponent } from '../../shared/components/nav-icon/nav-icon.component';
import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent (Apertura Suave, Sombreado Deslizante y Timer de 3s)', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;
  let userStore: CurrentUserStore;
  let verificationStore: FixerVerificationStore;

  beforeEach(async () => {
    vi.useFakeTimers();

    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        CurrentUserStore,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    userStore = TestBed.inject(CurrentUserStore);
    verificationStore = TestBed.inject(FixerVerificationStore);
    userStore.setRoles(['OWNER']);

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debe calcular el índice activo inicial y renderizar el sombreado deslizante', () => {
    expect(component.activeIndex()).toBe(0);
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.sliding-highlight')).toBeTruthy();
  });

  it('debe expandirse suavemente en mouseenter y permanecer 3 segundos tras mouseleave antes de colapsar', () => {
    expect(component.isExpanded()).toBe(false);

    // Entrada del cursor: abre de inmediato
    component.onMouseEnter();
    expect(component.isExpanded()).toBe(true);

    // Salida del cursor: debe esperar al menos 3 segundos
    component.onMouseLeave();
    expect(component.isExpanded()).toBe(true);

    // Tras 1.5s sigue abierto
    vi.advanceTimersByTime(1500);
    expect(component.isExpanded()).toBe(true);

    // Tras 3s totales se colapsa suavemente
    vi.advanceTimersByTime(1500);
    expect(component.isExpanded()).toBe(false);
  });

  it('debe cancelar el temporizador de colapso si el cursor reingresa antes de los 3 segundos', () => {
    component.onMouseEnter();
    expect(component.isExpanded()).toBe(true);

    component.onMouseLeave();
    vi.advanceTimersByTime(1500);
    expect(component.isExpanded()).toBe(true);

    // El cursor reingresa antes de los 3s
    component.onMouseEnter();
    vi.advanceTimersByTime(2000);
    // Debe continuar abierto indefinidamente
    expect(component.isExpanded()).toBe(true);
  });

  it('al seleccionar una sección, actualiza la ruta y desplaza el sombreado inmediatamente', () => {
    component.onSelectNav('/properties');
    expect(component.currentUrl()).toBe('/properties');
    expect(component.activeIndex()).toBe(1);
  });

  function setRole(role: 'OWNER' | 'FIXER' | 'PLATFORM_ADMIN' | 'TENANT' | 'REAL_ESTATE_MANAGER'): string[] {
    userStore.setRoles([role]);
    userStore.setActiveRole(role);
    fixture.detectChanges();
    return component.visibleItems().map((item) => item.path);
  }

  it('muestra las propiedades y solicitudes del OWNER sin el placeholder de técnicos', () => {
    const paths = setRole('OWNER');
    expect(paths).toContain('/properties');
    expect(paths).toContain('/requests');
    expect(paths).not.toContain('/fixers');
  });

  it('oculta inbox y portafolio al FIXER no verificado', () => {
    const paths = setRole('FIXER');
    expect(paths).toContain('/fixers/verification');
    expect(paths).toContain('/quotations/me');
    expect(paths).toContain('/jobs/me');
    expect(paths).toContain('/payments/earnings');
    expect(paths).not.toContain('/requests/inbox');
    expect(paths).not.toContain('/fixers/portfolio');
  });

  it('muestra la navegación completa al FIXER verificado', () => {
    vi.spyOn(verificationStore, 'verified').mockReturnValue(true);
    const paths = setRole('FIXER');
    expect(paths).toContain('/requests/inbox');
    expect(paths).toContain('/fixers/portfolio');
  });

  it('muestra revisión de técnicos y no propiedades ni solicitudes al PLATFORM_ADMIN', () => {
    const paths = setRole('PLATFORM_ADMIN');
    expect(paths).toContain('/administration/fixer-review');
    expect(paths).not.toContain('/properties');
    expect(paths).not.toContain('/requests');
  });

  it('muestra solicitudes y contratos para TENANT sin exponer propiedades', () => {
    const paths = setRole('TENANT');
    expect(paths).toEqual([
      '/dashboard',
      '/properties/search',
      '/requests',
      '/contracts',
      '/notifications',
      '/profile'
    ]);
    expect(paths).not.toContain('/properties');
  });

  it('muestra herramientas completas de administración inmobiliaria para REAL_ESTATE_MANAGER', () => {
    const paths = setRole('REAL_ESTATE_MANAGER');
    expect(paths).toEqual([
      '/dashboard',
      '/properties',
      '/administration/properties/bulk-upload',
      '/contracts',
      '/requests',
      '/notifications',
      '/profile'
    ]);
  });

  it('selecciona /properties para "Mis propiedades" y /properties/search para "Explorar inmuebles" (resolución más específica)', () => {
    setRole('OWNER');
    // Para OWNER:
    // 0: /dashboard
    // 1: /properties (Mis propiedades)
    // 2: /properties/search (Explorar inmuebles)
    component.onSelectNav('/properties');
    expect(component.activeIndex()).toBe(1);

    component.onSelectNav('/properties/search');
    expect(component.activeIndex()).toBe(2);
  });

  it('reconoce rutas anidadas como /requests/req-123 seleccionando "Mis solicitudes"', () => {
    setRole('OWNER');
    // 4: /requests (Mis solicitudes)
    component.onSelectNav('/requests/req-123');
    expect(component.activeIndex()).toBe(4);
  });

  it('todos los NavigationIcon tienen representación visual SVG válida sin "?" ni emojis', () => {
    const allIcons: NavigationIcon[] = [
      'dashboard',
      'properties',
      'requests',
      'quotations',
      'jobs',
      'earnings',
      'verification',
      'portfolio',
      'review',
      'notifications',
      'contracts',
      'explore',
      'sla-board',
      'bulk-properties',
      'profile'
    ];

    allIcons.forEach((iconName) => {
      const iconFixture = TestBed.createComponent(NavIconComponent);
      iconFixture.componentRef.setInput('name', iconName);
      iconFixture.detectChanges();
      const el = iconFixture.nativeElement as HTMLElement;
      const svg = el.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(el.textContent?.trim()).toBe('');
      expect(el.textContent).not.toContain('?');
    });
  });

  it('resalta la sección Remodelaciones cuando el contexto proviene de una remodelación', () => {
    userStore.setRoles(['OWNER']);
    userStore.setActiveRole('OWNER');
    fixture.detectChanges();

    component.onSelectNav('/quotations/request/req-123?from=remodelings&projectId=proj-456');
    fixture.detectChanges();

    const remodelingIndex = component.visibleItems().findIndex((i) => i.path === '/remodelings');
    expect(remodelingIndex).toBeGreaterThanOrEqual(0);
    expect(component.activeIndex()).toBe(remodelingIndex);
  });

  it('resalta la sección Mis solicitudes cuando se consultan cotizaciones sin contexto de remodelación', () => {
    userStore.setRoles(['OWNER']);
    userStore.setActiveRole('OWNER');
    fixture.detectChanges();

    component.onSelectNav('/quotations/request/req-123');
    fixture.detectChanges();

    const requestsIndex = component.visibleItems().findIndex((i) => i.path === '/requests');
    expect(requestsIndex).toBeGreaterThanOrEqual(0);
    expect(component.activeIndex()).toBe(requestsIndex);
  });

  it('renderiza el badge y punto de notificaciones cuando existen mensajes sin leer', () => {
    userStore.setRoles(['OWNER']);
    userStore.setActiveRole('OWNER');
    component.notificationsStore.unreadCount.set(3);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.item-badge');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('3');

    const dot = fixture.nativeElement.querySelector('.unread-icon-dot');
    expect(dot).toBeTruthy();
  });
});
