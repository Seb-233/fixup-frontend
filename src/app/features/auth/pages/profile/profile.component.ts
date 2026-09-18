import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../core/auth/auth.service';
import { CurrentUserStore } from '../../../../core/auth/current-user.store';

// Pantalla de visualización del perfil del usuario autenticado y sus roles backend
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="profile-card">
      <h1 class="title">Mi Perfil</h1>
      <p class="subtitle">Datos de cuenta y roles sincronizados desde el backend de FixUp.</p>

      @if (userStore.user(); as user) {
        <div class="data-group">
          <div class="field">
            <span class="label">Identificador interno:</span>
            <span class="value font-mono">{{ user.id }}</span>
          </div>

          <div class="field">
            <span class="label">Nombre para mostrar:</span>
            <span class="value">{{ user.displayName || 'No especificado' }}</span>
          </div>

          <div class="field">
            <span class="label">Correo electrónico:</span>
            <span class="value">{{ user.email || 'No disponible' }}</span>
          </div>

          <div class="field">
            <span class="label">Estado de la cuenta:</span>
            <span class="status-badge" [class.active]="user.status === 'ACTIVE'">
              {{ user.status }}
            </span>
          </div>

          <div class="field">
            <span class="label">Roles asignados:</span>
            <div class="roles-list">
              @for (role of user.roles; track role) {
                <span class="role-badge">{{ role }}</span>
              } @empty {
                <span class="empty-roles">Sin roles asignados</span>
              }
            </div>
          </div>
        </div>
      } @else {
        <p class="loading-text">Cargando datos del usuario...</p>
      }

      <div class="actions">
        <button type="button" class="btn-logout" (click)="auth.logout()">Cerrar sesión</button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      justify-content: center;
      padding: 2.5rem 1rem;
    }
    .profile-card {
      background: #ffffff;
      border-radius: 12px;
      box-shadow: var(--fixup-shadow-md);
      padding: 2.5rem 2rem;
      max-width: 600px;
      width: 100%;
    }
    .title {
      font-family: var(--fixup-font-heading);
      color: var(--fixup-color-primary);
      font-size: 1.6rem;
      margin: 0 0 0.5rem 0;
    }
    .subtitle {
      color: #666666;
      font-size: 0.95rem;
      margin: 0 0 2rem 0;
    }
    .data-group {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      border-top: 1px solid #eeeeee;
      padding-top: 1.5rem;
      margin-bottom: 2rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #888888;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .value {
      font-size: 1rem;
      color: var(--fixup-color-primary);
    }
    .font-mono {
      font-family: monospace;
      font-size: 0.9rem;
      background: #f4f4f5;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      width: fit-content;
    }
    .status-badge {
      display: inline-block;
      width: fit-content;
      font-size: 0.8rem;
      font-weight: 700;
      padding: 0.25rem 0.6rem;
      border-radius: 4px;
      background: #fef2f2;
      color: #b91c1c;
    }
    .status-badge.active {
      background: #ecfdf5;
      color: #047857;
    }
    .roles-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.25rem;
    }
    .role-badge {
      background: var(--fixup-color-primary);
      color: #ffffff;
      font-size: 0.8rem;
      font-weight: 600;
      padding: 0.25rem 0.6rem;
      border-radius: 4px;
    }
    .empty-roles {
      font-size: 0.9rem;
      color: #888888;
      font-style: italic;
    }
    .actions {
      border-top: 1px solid #eeeeee;
      padding-top: 1.5rem;
    }
    .btn-logout {
      background-color: #ef4444;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 0.75rem 1.5rem;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    .btn-logout:hover {
      background-color: #dc2626;
    }
  `]
})
export class ProfileComponent {
  readonly auth = inject(AuthService);
  readonly userStore = inject(CurrentUserStore);
}
