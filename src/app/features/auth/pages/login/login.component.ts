import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../core/auth/auth.service';

// Pantalla de inicio de sesión con redirección segura hacia Auth0
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="auth-card">
      <h1 class="auth-title">Bienvenido a FixUp</h1>
      <p class="auth-subtitle">Inicia sesión de forma segura para gestionar tus propiedades y servicios.</p>

      <button
        type="button"
        class="auth-btn-primary"
        (click)="login()"
        [disabled]="auth.isLoading$ | async"
      >
        Iniciar sesión con Auth0
      </button>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 70vh;
      padding: 1.5rem;
    }
    .auth-card {
      background: #ffffff;
      border-radius: 12px;
      box-shadow: var(--fixup-shadow-md);
      padding: 2.5rem 2rem;
      max-width: 440px;
      width: 100%;
      text-align: center;
    }
    .auth-title {
      font-family: var(--fixup-font-heading);
      color: var(--fixup-color-primary);
      font-size: 1.75rem;
      margin-bottom: 0.75rem;
    }
    .auth-subtitle {
      color: #666666;
      font-size: 0.95rem;
      margin-bottom: 2rem;
      line-height: 1.4;
    }
    .auth-btn-primary {
      background-color: var(--fixup-color-primary);
      color: #ffffff;
      border: 1px solid var(--fixup-color-primary);
      border-radius: 8px;
      padding: 0.85rem 1.5rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      transition: background-color 0.2s ease;
    }
    .auth-btn-primary:hover:not(:disabled) {
      background-color: var(--fixup-color-accent);
      border-color: var(--fixup-color-accent);
      color: var(--fixup-color-primary);
    }
    .auth-btn-primary:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `]
})
export class LoginComponent {
  readonly auth = inject(AuthService);

  login(): void {
    this.auth.loginWithRedirect();
  }
}
