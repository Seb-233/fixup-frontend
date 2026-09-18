import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AuthService } from '../../../../core/auth/auth.service';
import { CurrentUserStore } from '../../../../core/auth/current-user.store';
import { SelectRoleComponent } from './select-role.component';

describe('SelectRoleComponent', () => {
  let component: SelectRoleComponent;
  let fixture: ComponentFixture<SelectRoleComponent>;
  let userStore: CurrentUserStore;
  let authServiceMock: {
    selectRole: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    authServiceMock = {
      selectRole: vi.fn(),
      logout: vi.fn()
    };

    await TestBed.configureTestingModule({
      imports: [SelectRoleComponent],
      providers: [
        CurrentUserStore,
        { provide: AuthService, useValue: authServiceMock }
      ]
    }).compileComponents();

    userStore = TestBed.inject(CurrentUserStore);
    fixture = TestBed.createComponent(SelectRoleComponent);
    component = fixture.componentInstance;
  });

  it('debe mostrar estado sin roles si el backend devuelve roles vacío', () => {
    userStore.setRoles([]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Cuenta sin roles asignados');
    expect(compiled.querySelectorAll('.role-option').length).toBe(0);
  });

  it('debe renderizar únicamente los roles devueltos por el backend', () => {
    userStore.setProfile({
      id: 'uuid-1',
      email: 'owner@fixup.com',
      displayName: 'Owner User',
      status: 'ACTIVE',
      roles: ['OWNER', 'TENANT']
    });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = compiled.querySelectorAll('.role-option');
    expect(buttons.length).toBe(2);

    const textContent = compiled.textContent || '';
    expect(textContent).toContain('Propietario');
    expect(textContent).toContain('Arrendatario');
    expect(textContent).not.toContain('Técnico / Fixer');
  });

  it('NUNCA debe mostrar opciones para PLATFORM_ADMIN ni REAL_ESTATE_MANAGER', () => {
    userStore.setRoles(['OWNER']);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const textContent = compiled.textContent || '';
    expect(textContent).not.toContain('PLATFORM_ADMIN');
    expect(textContent).not.toContain('REAL_ESTATE_MANAGER');
  });

  it('debe mostrar la advertencia de verificación si se selecciona FIXER', () => {
    userStore.setRoles(['FIXER']);
    fixture.detectChanges();

    component.selectRole('FIXER');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.warning-banner')).toBeTruthy();
    expect(compiled.textContent).toContain('validación');
  });

  it('debe invocar auth.selectRole al confirmar la selección del rol', () => {
    userStore.setRoles(['OWNER']);
    fixture.detectChanges();

    component.selectRole('OWNER');
    component.confirmSelection();

    expect(authServiceMock.selectRole).toHaveBeenCalledWith('OWNER');
  });
});
