import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../../core/auth/auth.service';
import { CurrentUserStore } from '../../../../core/auth/current-user.store';
import { INITIAL_ROLE_OPTIONS } from '../../../../core/auth/auth.types';
import { SelectRoleComponent } from './select-role.component';

describe('SelectRoleComponent (Selección de Rol Inicial en Onboarding)', () => {
  let component: SelectRoleComponent;
  let fixture: ComponentFixture<SelectRoleComponent>;
  let userStore: CurrentUserStore;
  let routerNavigateSpy: ReturnType<typeof vi.fn>;
  let authServiceMock: {
    selectInitialRole: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    routerNavigateSpy = vi.fn();
    authServiceMock = {
      selectInitialRole: vi.fn().mockReturnValue(of({
        id: 'user-1',
        email: 'test@fixup.com',
        displayName: 'Test User',
        status: 'ACTIVE',
        roles: ['OWNER']
      })),
      logout: vi.fn().mockReturnValue(of(undefined))
    };

    await TestBed.configureTestingModule({
      imports: [SelectRoleComponent],
      providers: [
        CurrentUserStore,
        { provide: AuthService, useValue: authServiceMock },
        { provide: Router, useValue: { navigate: routerNavigateSpy } }
      ]
    }).compileComponents();

    userStore = TestBed.inject(CurrentUserStore);
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(SelectRoleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('1. roles: [] muestra OWNER, TENANT y FIXER para el onboarding inicial', () => {
    userStore.setRoles([]);
    createComponent();

    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = compiled.querySelectorAll('.role-option');
    expect(buttons.length).toBe(3);

    const textContent = compiled.textContent || '';
    expect(textContent).toContain('Propietario');
    expect(textContent).toContain('Arrendatario');
    expect(textContent).toContain('Técnico / Fixer');
    expect(textContent).not.toContain('Cuenta sin roles asignados');
  });

  it('2. no aparece ningún rol administrativo en la selección', () => {
    userStore.setRoles([]);
    createComponent();

    const compiled = fixture.nativeElement as HTMLElement;
    const textContent = compiled.textContent || '';
    expect(textContent).not.toContain('PLATFORM_ADMIN');
    expect(textContent).not.toContain('REAL_ESTATE_MANAGER');
  });

  it('3. solo puede enviarse uno de los roles permitidos por el contrato (OWNER, TENANT, FIXER)', () => {
    userStore.setRoles([]);
    createComponent();

    expect(component.roleOptions.map((opt) => opt.role)).toEqual(INITIAL_ROLE_OPTIONS);
    expect(component.roleOptions.map((opt) => opt.role)).toEqual(['OWNER', 'TENANT', 'FIXER']);
  });

  it('8. la selección ejecuta selectInitialRole con el rol elegido y confirma', () => {
    userStore.setRoles([]);
    createComponent();

    component.selectRole('OWNER');
    fixture.detectChanges();

    component.confirmSelection();
    expect(authServiceMock.selectInitialRole).toHaveBeenCalledWith('OWNER');
  });

  it('9. un usuario con roles existentes (roles.length > 0) no vuelve a seleccionar un rol inicial y es redirigido a /dashboard', () => {
    userStore.setRoles(['OWNER']);
    createComponent();

    expect(routerNavigateSpy).toHaveBeenCalledWith(['/dashboard'], { replaceUrl: true });
  });

  it('10. los errores 400, 403 o 409 del backend se muestran en pantalla sin modificar localmente los roles', () => {
    userStore.setRoles([]);
    authServiceMock.selectInitialRole.mockReturnValue(
      throwError(() => ({
        status: 409,
        error: { code: 'ROLE_ALREADY_ASSIGNED', message: 'El usuario ya cuenta con un rol asignado' }
      }))
    );

    createComponent();

    component.selectRole('TENANT');
    fixture.detectChanges();

    component.confirmSelection();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const errorBanner = compiled.querySelector('.error-banner');
    expect(errorBanner).toBeTruthy();
    expect(errorBanner?.textContent).toContain('El usuario ya cuenta con un rol asignado');
    expect(userStore.roles()).toEqual([]);
  });

  it('muestra la advertencia de verificación con estado PENDING si se selecciona FIXER', () => {
    userStore.setRoles([]);
    createComponent();

    component.selectRole('FIXER');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const banner = compiled.querySelector('.warning-banner');
    expect(banner).toBeTruthy();
    expect(banner?.textContent).toContain('PENDING');
  });
});
