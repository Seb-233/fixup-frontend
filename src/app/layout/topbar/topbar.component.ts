import { Component, computed, inject } from '@angular/core';
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
      <!-- Marca y Navegación Rápida -->
      <div class="topbar-left">
        <a routerLink="/dashboard" class="brand-link" title="Ir al panel principal">
          <div class="brand-badge-mini" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M3 10.5L12 3l9 7.5v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 19.5v-9z" stroke-linejoin="round"/>
              <circle cx="17.5" cy="7.5" r="1.5" fill="#CEAC78" stroke="none"/>
            </svg>
          </div>
          <span class="brand-name">FixUp</span>
        </a>

        <div class="header-divider" aria-hidden="true"></div>

        <!-- Barra de Atajo / Búsqueda Global -->
        <div class="quick-search-wrapper" role="search">
          <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
          </svg>
          <input
            type="text"
            class="search-input"
            placeholder="Buscar inmuebles, solicitudes, técnicos..."
            aria-label="Buscar en FixUp"
          />
          <kbd class="shortcut-kbd" title="Atajo de búsqueda">⌘K</kbd>
        </div>
      </div>

      <!-- Atajos y Acciones Rápidas del Usuario -->
      <div class="topbar-right">
        @if (userStore.authenticated()) {
          <!-- Atajo 1: Botón de Nueva Solicitud -->
          <a routerLink="/requests" class="btn-shortcut-action" title="Crear nueva solicitud de servicio">
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
            </svg>
            <span class="btn-shortcut-text">Nueva Solicitud</span>
          </a>

          <!-- Atajo 2: Campana de Notificaciones -->
          <button type="button" class="btn-icon-shortcut" title="Notificaciones del sistema" aria-label="Notificaciones">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
            </svg>
            <span class="notification-badge" aria-label="2 notificaciones pendientes">2</span>
          </button>

          <div class="header-divider" aria-hidden="true"></div>

          <!-- Chip de Usuario con Enlace a Perfil -->
          <a routerLink="/profile" class="user-profile-chip" title="Ver mi perfil">
            <div class="user-avatar" aria-hidden="true">
              {{ userInitials() }}
            </div>
            <div class="user-details">
              <span class="user-name">{{ userStore.user()?.displayName || userStore.user()?.email }}</span>
              @if (userStore.activeRole(); as role) {
                <span class="role-badge-chip">
                  <span class="role-dot" aria-hidden="true"></span>
                  {{ role }}
                </span>
              }
            </div>
          </a>

          <!-- Botón de Cerrar Sesión -->
          <button type="button" class="btn-logout" (click)="logout()" title="Cerrar sesión de FixUp">
            <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd" />
            </svg>
            <span class="logout-text">Salir</span>
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

  readonly userInitials = computed<string>(() => {
    const user = this.userStore.user();
    if (!user) return 'FX';
    if (user.displayName) {
      const parts = user.displayName.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return parts[0].slice(0, 2).toUpperCase();
    }
    if (user.email) {
      return user.email.slice(0, 2).toUpperCase();
    }
    return 'FX';
  });

  logout(): void {
    this.auth.logout().subscribe();
  }
}
