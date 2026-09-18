import { Injectable, computed, signal } from '@angular/core';
import { BackendUserProfile, Role, UserStatus } from './auth.types';

// Almacén reactivo en memoria para el estado y perfil del usuario autenticado
@Injectable({
  providedIn: 'root'
})
export class CurrentUserStore {
  private readonly userState = signal<BackendUserProfile | null>(null);
  private readonly loadingState = signal<boolean>(false);
  private readonly profileLoadedState = signal<boolean>(false);
  private readonly errorState = signal<string | null>(null);

  readonly user = this.userState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
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
  }

  // Actualiza el conjunto de roles tras la asignación inicial
  setRoles(roles: Role[]): void {
    const current = this.userState();
    if (current) {
      this.userState.set({ ...current, roles });
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
    this.loadingState.set(false);
    this.profileLoadedState.set(false);
    this.errorState.set(null);
  }
}
