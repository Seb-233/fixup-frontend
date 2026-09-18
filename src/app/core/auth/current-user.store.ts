import { Injectable, computed, signal } from '@angular/core';
import { BackendUserProfile, Role, UserStatus } from './auth.types';

// Almacén reactivo en memoria para el estado y perfil del usuario autenticado
@Injectable({
  providedIn: 'root'
})
export class CurrentUserStore {
  private readonly userState = signal<BackendUserProfile | null>(null);
  private readonly activeRoleState = signal<Role | null>(null);
  private readonly loadingState = signal<boolean>(false);
  private readonly profileLoadedState = signal<boolean>(false);
  private readonly errorState = signal<string | null>(null);

  readonly user = this.userState.asReadonly();
  readonly activeRole = this.activeRoleState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly initialized = this.profileLoadedState.asReadonly();
  readonly profileLoaded = this.profileLoadedState.asReadonly();
  readonly error = this.errorState.asReadonly();

  readonly authenticated = computed(() => this.userState() !== null);
  readonly roles = computed<Role[]>(() => this.userState()?.roles ?? []);
  readonly status = computed<UserStatus | null>(() => this.userState()?.status ?? null);

  // Actualiza el perfil interno obtenido desde el backend
  setProfile(profile: BackendUserProfile): void {
    this.userState.set(profile);
    this.profileLoadedState.set(true);
    this.errorState.set(null);

    // Si el rol activo previamente seleccionado ya no pertenece a los roles, o no existía pero hay roles disponibles
    const currentActive = this.activeRoleState();
    if (currentActive && !profile.roles.includes(currentActive)) {
      this.activeRoleState.set(profile.roles.length > 0 ? profile.roles[0] : null);
    } else if (!currentActive && profile.roles.length > 0) {
      this.activeRoleState.set(profile.roles[0]);
    }
  }

  // Establece el rol actualmente activo
  setActiveRole(role: Role | null): void {
    this.activeRoleState.set(role);
  }

  // Actualiza el conjunto de roles tras asignación
  setRoles(roles: Role[]): void {
    const current = this.userState();
    if (current) {
      this.userState.set({ ...current, roles });
    } else {
      this.userState.set({
        id: 'temp-user',
        email: null,
        displayName: '',
        status: 'ACTIVE',
        roles
      });
      this.profileLoadedState.set(true);
    }

    if (!this.activeRoleState() && roles.length > 0) {
      this.activeRoleState.set(roles[0]);
    }
  }

  setLoading(loading: boolean): void {
    this.loadingState.set(loading);
  }

  setError(error: string | null): void {
    this.errorState.set(error);
  }

  hasRole(role: Role): boolean {
    return this.roles().includes(role);
  }

  hasAnyRole(roles: Role[]): boolean {
    return roles.some((r) => this.roles().includes(r));
  }

  isActive(): boolean {
    return this.status() === 'ACTIVE';
  }

  // Limpia completamente el estado al cerrar sesión
  clear(): void {
    this.userState.set(null);
    this.activeRoleState.set(null);
    this.loadingState.set(false);
    this.profileLoadedState.set(false);
    this.errorState.set(null);
  }
}
