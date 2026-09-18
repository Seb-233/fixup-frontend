import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <header class="topbar">
      <div class="topbar-brand">
        <a routerLink="/dashboard" class="brand-link">
          <span class="brand-name">FixUp</span>
        </a>
      </div>
      <div class="topbar-actions">
        @if (userStore.authenticated()) {
          <div class="user-info">
            <span class="user-greeting">{{ userStore.user()?.displayName || userStore.user()?.email }}</span>
            @if (userStore.activeRole(); as role) {
              <span class="role-badge">{{ role }}</span>
            }
          </div>
          <button type="button" class="btn-logout" (click)="logout()" title="Cerrar sesión">
            Cerrar sesión
          </button>
        } @else {
          <span class="user-greeting">Bienvenido a FixUp</span>
        }
      </div>
    </header>
  `,
  styleUrls: ['./topbar.component.scss']
})
export class TopbarComponent {
  readonly userStore = inject(CurrentUserStore);
  readonly auth = inject(AuthService);

  logout(): void {
    this.auth.logout().subscribe();
  }
}
