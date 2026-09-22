import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi, afterEach, beforeEach, describe, it, expect } from 'vitest';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent (Apertura Suave, Sombreado Deslizante y Timer de 3s)', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;
  let userStore: CurrentUserStore;

  beforeEach(async () => {
    vi.useFakeTimers();

    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        CurrentUserStore,
        provideRouter([])
      ]
    }).compileComponents();

    userStore = TestBed.inject(CurrentUserStore);
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

  it('muestra todas las funcionalidades desktop reales del FIXER', () => {
    const paths = setRole('FIXER');
    expect(paths).toEqual([
      '/dashboard', '/requests/inbox', '/quotations/me', '/jobs/me', '/payments/earnings',
      '/fixers/verification', '/fixers/portfolio', '/profile'
    ]);
    expect(paths).not.toContain('/properties');
  });

  it('muestra revisión de técnicos y no propiedades ni solicitudes al PLATFORM_ADMIN', () => {
    const paths = setRole('PLATFORM_ADMIN');
    expect(paths).toContain('/administration/fixer-review');
    expect(paths).not.toContain('/properties');
    expect(paths).not.toContain('/requests');
  });

  it('muestra solicitudes para TENANT sin exponer propiedades', () => {
    const paths = setRole('TENANT');
    expect(paths).toEqual(['/dashboard', '/requests', '/profile']);
    expect(paths).not.toContain('/properties');
  });

  it('muestra solicitudes para REAL_ESTATE_MANAGER sin exponer propiedades', () => {
    const paths = setRole('REAL_ESTATE_MANAGER');
    expect(paths).toEqual(['/dashboard', '/requests', '/profile']);
    expect(paths).not.toContain('/properties');
  });
});
