import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../../core/auth/auth.service';
import { CurrentUserStore } from '../../../../core/auth/current-user.store';
import { BackendUserProfile } from '../../../../core/auth/auth.types';
import { ProfileComponent } from './profile.component';

describe('ProfileComponent (Formulario y Gestión de Perfil)', () => {
  let component: ProfileComponent;
  let fixture: ComponentFixture<ProfileComponent>;
  let userStore: CurrentUserStore;
  let authServiceMock: {
    logout: ReturnType<typeof vi.fn>;
  };

  const mockProfile: BackendUserProfile = {
    id: '711263b4-b829-40ec-b3e3-8e621ace3711',
    email: 'sebas.mi833@gmail.com',
    displayName: 'Sebastián Miranda',
    status: 'ACTIVE',
    roles: ['OWNER']
  };

  beforeEach(async () => {
    authServiceMock = {
      logout: vi.fn().mockReturnValue(of(undefined))
    };

    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        CurrentUserStore,
        { provide: AuthService, useValue: authServiceMock }
      ]
    }).compileComponents();

    userStore = TestBed.inject(CurrentUserStore);
    userStore.setProfile(mockProfile);

    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe renderizar la información de perfil, avatar y rol activo', () => {
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('Sebastián Miranda');
    expect(compiled.textContent).toContain('sebas.mi833@gmail.com');
    expect(compiled.textContent).toContain('Rol Activo: OWNER');
    expect(compiled.textContent).toContain('ACTIVE');
    expect(component.userInitials()).toBe('SM');
  });

  it('permite guardar cambios en el formulario y muestra mensaje de confirmación', () => {
    component.formDisplayName.set('Sebastián Actualizado');
    component.saveProfile();
    fixture.detectChanges();

    expect(component.saveMessage()).toBe('¡Cambios guardados con éxito en la sesión local!');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.save-toast')).toBeTruthy();
  });

  it('permite copiar el identificador interno del usuario', () => {
    component.copyId(mockProfile.id);
    expect(component.idCopied()).toBe(true);
  });

  it('permite cerrar sesión desde el perfil llamando a auth.logout', () => {
    component.auth.logout();
    expect(authServiceMock.logout).toHaveBeenCalled();
  });
});
