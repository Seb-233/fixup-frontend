import { TestBed } from '@angular/core/testing';
import { CurrentUserStore } from './current-user.store';
import { BackendUserProfile, Role } from './auth.types';

describe('CurrentUserStore', () => {
  let store: CurrentUserStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [CurrentUserStore]
    });
    store = TestBed.inject(CurrentUserStore);
  });

  it('debe inicializarse vacío y sin usuario autenticado', () => {
    expect(store.user()).toBeNull();
    expect(store.authenticated()).toBe(false);
    expect(store.roles()).toEqual([]);
    expect(store.status()).toBeNull();
    expect(store.profileLoaded()).toBe(false);
  });

  it('debe almacenar el perfil interno usando los tipos estrictos de Role y UserStatus', () => {
    const roles: Role[] = ['OWNER', 'TENANT'];
    const mockProfile: BackendUserProfile = {
      id: 'uuid-1234',
      email: 'owner@fixup.com',
      displayName: 'Carlos Propietario',
      status: 'ACTIVE',
      roles
    };

    store.setProfile(mockProfile);

    expect(store.user()).toEqual(mockProfile);
    expect(store.authenticated()).toBe(true);
    expect(store.profileLoaded()).toBe(true);
    expect(store.roles()).toEqual(['OWNER', 'TENANT']);
    expect(store.activeRole()).toBe('OWNER');
    expect(store.status()).toBe('ACTIVE');
    expect(store.isActive()).toBe(true);
  });

  it('debe verificar correctamente hasRole y hasAnyRole', () => {
    store.setProfile({
      id: 'uuid-1234',
      email: null,
      displayName: 'Usuario Demo',
      status: 'ACTIVE',
      roles: ['TENANT']
    });

    expect(store.hasRole('TENANT')).toBe(true);
    expect(store.hasRole('OWNER')).toBe(false);
    expect(store.hasAnyRole(['OWNER', 'TENANT'])).toBe(true);
    expect(store.hasAnyRole(['FIXER', 'PLATFORM_ADMIN'])).toBe(false);
  });

  it('debe reflejar isActive como false para cuentas SUSPENDED o DISABLED', () => {
    store.setProfile({
      id: 'uuid-1234',
      email: 'disabled@fixup.com',
      displayName: 'Cuenta Inactiva',
      status: 'SUSPENDED',
      roles: ['FIXER']
    });

    expect(store.isActive()).toBe(false);
  });

  it('debe limpiar completamente el estado al invocar clear()', () => {
    store.setProfile({
      id: 'uuid-1234',
      email: 'carlos@fixup.com',
      displayName: 'Carlos',
      status: 'ACTIVE',
      roles: ['OWNER']
    });

    store.clear();

    expect(store.user()).toBeNull();
    expect(store.authenticated()).toBe(false);
    expect(store.profileLoaded()).toBe(false);
    expect(store.roles()).toEqual([]);
  });
});
