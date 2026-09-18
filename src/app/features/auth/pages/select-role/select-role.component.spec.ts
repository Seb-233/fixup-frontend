import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../../core/auth/auth.service';
import { CurrentUserStore } from '../../../../core/auth/current-user.store';
import { SelectRoleComponent } from './select-role.component';

describe('SelectRoleComponent', () => {
  let component: SelectRoleComponent;
  let fixture: ComponentFixture<SelectRoleComponent>;
  let authServiceMock: {
    selectInitialRole: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    authServiceMock = {
      selectInitialRole: vi.fn().mockReturnValue(of({}))
    };

    await TestBed.configureTestingModule({
      imports: [SelectRoleComponent],
      providers: [
        CurrentUserStore,
        { provide: AuthService, useValue: authServiceMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SelectRoleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('debe renderizar únicamente las 3 opciones de rol permitidas: Propietario, Arrendatario y Fixer', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const buttons = compiled.querySelectorAll('.role-option');
    expect(buttons.length).toBe(3);

    const textContent = compiled.textContent || '';
    expect(textContent).toContain('Propietario');
    expect(textContent).toContain('Arrendatario');
    expect(textContent).toContain('Técnico / Fixer');
  });

  it('NUNCA debe mostrar opciones para PLATFORM_ADMIN ni REAL_ESTATE_MANAGER', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const textContent = compiled.textContent || '';
    expect(textContent).not.toContain('PLATFORM_ADMIN');
    expect(textContent).not.toContain('REAL_ESTATE_MANAGER');
    expect(textContent).not.toContain('Administrador');
    expect(textContent).not.toContain('Inmobiliaria');
  });

  it('debe mostrar la advertencia de verificación si se selecciona FIXER', () => {
    component.selectRole('FIXER');
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.warning-banner')).toBeTruthy();
    expect(compiled.textContent).toContain('verificación');
  });

  it('debe invocar selectInitialRole al confirmar la selección del rol', () => {
    component.selectRole('OWNER');
    component.confirmSelection();

    expect(authServiceMock.selectInitialRole).toHaveBeenCalledWith('OWNER');
  });
});
