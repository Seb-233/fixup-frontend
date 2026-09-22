import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi, afterEach, beforeEach, describe, it, expect } from 'vitest';
import { FixerVerificationStore } from '../../features/fixers/pages/verification/fixer-verification.store';
import { CurrentUserStore } from '../../core/auth/current-user.store';
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
        provideRouter([])
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
