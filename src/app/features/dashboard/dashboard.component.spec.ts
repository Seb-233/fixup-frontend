import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent (Landing Principal Autenticada)', () => {
  let component: DashboardComponent;
  let fixture: ComponentFixture<DashboardComponent>;
  let userStore: CurrentUserStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        CurrentUserStore,
        provideRouter([])
      ]
    }).compileComponents();

    userStore = TestBed.inject(CurrentUserStore);
    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
  });

  it('debe renderizar el saludo y las secciones principales', () => {
    userStore.setProfile({
      id: 'uuid-1',
      email: 'carlos@fixup.com',
      displayName: 'Carlos Mendoza',
      status: 'ACTIVE',
      roles: ['OWNER']
    });
    userStore.setActiveRole('OWNER');
    fixture.detectChanges();

    expect(component).toBeTruthy();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.greeting-title')?.textContent).toContain('Carlos Mendoza');
    expect(compiled.querySelector('.role-badge')?.textContent).toContain('Propietario');
    expect(compiled.querySelector('.status-badge')?.textContent).toContain('activa');
    expect(compiled.querySelectorAll('.kpi-card').length).toBe(4);
  });

  it('debe adaptar las métricas y subtítulo al rol TENANT', () => {
    userStore.setProfile({
      id: 'uuid-2',
      email: 'ana@fixup.com',
      displayName: 'Ana Gómez',
      status: 'ACTIVE',
      roles: ['TENANT']
    });
    userStore.setActiveRole('TENANT');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.role-badge')?.textContent).toContain('Arrendatario');
    expect(compiled.textContent).toContain('Inmueble Residencia');
  });

  it('debe adaptar las métricas y mostrar estado PENDING para rol FIXER si aplica', () => {
    userStore.setProfile({
      id: 'uuid-3',
      email: 'fixer@fixup.com',
      displayName: 'Pedro Técnico',
      status: 'PENDING',
      roles: ['FIXER']
    });
    userStore.setActiveRole('FIXER');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.role-badge')?.textContent).toContain('Técnico Fixer');
    expect(compiled.querySelector('.status-badge.pending')?.textContent).toContain('Verificación en revisión');
    expect(compiled.textContent).toContain('Solicitudes en Zona');
  });

  it('debe enrutar /requests para OWNER', () => {
    userStore.setActiveRole('OWNER');
    fixture.detectChanges();
    expect(component.requestsPath()).toBe('/requests');
    expect(component.canManageRequests()).toBe(true);
  });

  it('debe enrutar /requests/inbox para FIXER', () => {
    userStore.setActiveRole('FIXER');
    fixture.detectChanges();
    expect(component.requestsPath()).toBe('/requests/inbox');
    expect(component.canManageRequests()).toBe(true);
  });

  it('no debe mostrar gestionar solicitudes para PLATFORM_ADMIN', () => {
    userStore.setActiveRole('PLATFORM_ADMIN');
    fixture.detectChanges();
    expect(component.canManageRequests()).toBe(false);
  });
});
