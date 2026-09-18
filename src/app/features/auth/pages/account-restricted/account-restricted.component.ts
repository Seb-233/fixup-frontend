import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../core/auth/auth.service';
import { CurrentUserStore } from '../../../../core/auth/current-user.store';

// Pantalla informativa para cuentas en estado SUSPENDED o DISABLED
@Component({
  selector: 'app-account-restricted',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="restricted-card">
      <div class="icon-warning" aria-hidden="true">⚠️</div>
      <h1 class="title">Cuenta Restringida</h1>
      <p class="description">
        Tu cuenta se encuentra temporalmente suspendida o deshabilitada. Las operaciones protegidas han sido bloqueadas por seguridad.
      </p>
      <div class="status-box">
        Estado actual: <strong>{{ userStore.status() ?? 'Inactiva' }}</strong>
      </div>
      <div class="actions">
        <button type="button" class="btn-secondary" (click)="auth.logout()">Cerrar sesión</button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 65vh;
      padding: 2rem 1rem;
    }
    .restricted-card {
      background: #ffffff;
      border-radius: 12px;
      box-shadow: var(--fixup-shadow-md);
      padding: 3rem 2rem;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    .icon-warning {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }
    .title {
      font-family: var(--fixup-font-heading);
      color: #b91c1c;
      font-size: 1.5rem;
      margin-bottom: 0.75rem;
    }
    .description {
      color: #555555;
      font-size: 0.95rem;
      line-height: 1.45;
      margin-bottom: 1.5rem;
    }
    .status-box {
      background-color: #fef2f2;
      border: 1px solid #fee2e2;
      color: #991b1b;
      padding: 0.75rem;
      border-radius: 6px;
      font-size: 0.9rem;
      margin-bottom: 2rem;
    }
    .btn-secondary {
      background-color: #4b5563;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 0.75rem 1.5rem;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    .btn-secondary:hover {
      background-color: #374151;
    }
  `]
})
export class AccountRestrictedComponent {
  readonly auth = inject(AuthService);
  readonly userStore = inject(CurrentUserStore);
}
