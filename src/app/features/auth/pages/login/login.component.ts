import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
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

      @if (errorMessage()) {
        <div class="auth-error-alert" role="alert">
          <span>{{ errorMessage() }}</span>
        </div>
      }

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
      min-height: 80vh;
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
      margin-bottom: 1.5rem;
      line-height: 1.4;
    }
    .auth-error-alert {
      background-color: #fee2e2;
      color: #991b1b;
      border: 1px solid #f87171;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      font-size: 0.875rem;
      margin-bottom: 1.5rem;
      text-align: left;
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
  private readonly route = inject(ActivatedRoute);

  readonly errorMessage = computed(() => {
    return this.route.snapshot.queryParamMap.get('error');
  });

  readonly safeReturnUrl = computed(() => {
    const rawUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    // Sanitización estricta: sólo URLs relativas internas que comiencen con / y no con //
    if (rawUrl && rawUrl.startsWith('/') && !rawUrl.startsWith('//')) {
      return rawUrl;
    }
    return '/dashboard';
  });

  login(): void {
    this.auth.loginWithRedirect(this.safeReturnUrl());
  }
}
