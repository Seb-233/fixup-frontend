import { Injectable, computed, signal } from '@angular/core';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  roles: string[];
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
