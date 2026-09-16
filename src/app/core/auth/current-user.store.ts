import { Injectable, computed, signal } from '@angular/core';

/**
 * Represents the authenticated user profile.
 * Roles and internal permissions are authoritative ONLY from the FixUp backend
 * (via GET /users/me) and never from Auth0 claims.
 */
export interface UserProfile {
  id: string;
  externalId: string;
  email: string;
  name: string;
  roles: string[];
  status?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CurrentUserStore {
  private readonly userState = signal<UserProfile | null>(null);
  private readonly loadingState = signal<boolean>(false);

  readonly user = this.userState.asReadonly();
  readonly isLoading = this.loadingState.asReadonly();
  readonly isAuthenticated = computed(() => this.userState() !== null);
  readonly roles = computed(() => this.userState()?.roles ?? []);

  setUser(user: UserProfile | null): void {
    this.userState.set(user);
  }

  setRoles(roles: string[]): void {
    const current = this.userState();
    if (current) {
      this.userState.set({ ...current, roles });
    }
  }

  setLoading(loading: boolean): void {
    this.loadingState.set(loading);
  }

  hasRole(role: string): boolean {
    return this.roles().includes(role);
  }

  hasAnyRole(roles: string[]): boolean {
    return roles.some((r) => this.roles().includes(r));
  }

  clear(): void {
    this.userState.set(null);
    this.loadingState.set(false);
  }
}
