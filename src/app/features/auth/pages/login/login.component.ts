import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';

// Pantalla de inicio de sesión con estética Glassmorphism, fondo ambiental difuminado y Auth0
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="login-wrapper">
      <!-- Orbes difuminados de fondo con animación suave de flotación -->
      <div class="ambient-orb orb-primary" aria-hidden="true"></div>
      <div class="ambient-orb orb-gold" aria-hidden="true"></div>
      <div class="ambient-orb orb-neutral" aria-hidden="true"></div>

      <!-- Tarjeta Glassmorphic principal -->
      <main class="auth-card">
        <!-- Emblema de marca FixUp -->
        <div class="brand-badge">
          <svg class="brand-logo" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect width="48" height="48" rx="14" fill="var(--fixup-color-primary)" />
            <path d="M14 26L24 16L34 26V35C34 35.5523 33.5523 36 33 36H15C14.4477 36 14 35.5523 14 35V26Z" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round" />
            <path d="M21 36V28H27V36" stroke="var(--fixup-color-accent)" stroke-width="2.5" stroke-linecap="round" />
            <circle cx="34" cy="16" r="3.5" fill="var(--fixup-color-accent)" />
          </svg>
        </div>

        <h1 class="auth-title">FixUp</h1>
        <p class="auth-tagline">Gestión inteligente de inmuebles y servicios técnicos</p>

        <!-- Etiquetas destacadas del ecosistema -->
        <div class="ecosystem-tags" aria-label="Perfiles admitidos">
          <span class="eco-tag">Propietarios</span>
          <span class="eco-tag">Arrendatarios</span>
          <span class="eco-tag">Técnicos Fixer</span>
        </div>

        @if (errorMessage()) {
          <div class="auth-error-alert" role="alert">
            <svg class="alert-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            <span>{{ errorMessage() }}</span>
          </div>
        }

        <!-- Botón de acción principal conectado a Auth0 -->
        <button
          type="button"
          class="auth-btn-primary"
          (click)="login()"
          [disabled]="auth.isLoading$ | async"
        >
          <svg class="auth-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <span>{{ (auth.isLoading$ | async) ? 'Conectando...' : 'Iniciar sesión con Auth0' }}</span>
        </button>

        <footer class="auth-footer">
          <p class="security-note">
            <svg class="shield-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M10 1.944A11.954 11.954 0 012.166 5C2.056 5.649 2 6.319 2 7c0 5.225 3.34 9.67 8 11.317C14.66 16.67 18 12.225 18 7c0-.682-.057-1.35-.166-2.001A11.954 11.954 0 0110 1.944zM11 14a1 1 0 11-2 0 1 1 0 012 0zm0-7a1 1 0 10-2 0v3a1 1 0 102 0V7z" clip-rule="evenodd" />
            </svg>
            Acceso seguro con cifrado Auth0 Enterprise
          </p>
        </footer>
      </main>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      width: 100%;
    }

    .login-wrapper {
      position: relative;
      min-height: 100vh;
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 1.5rem;
      background: #faf8f5;
      overflow: hidden;
    }

    /* Orbes difuminados flotantes */
    .ambient-orb {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      z-index: 0;
      opacity: 0.7;
    }

    .orb-primary {
      width: 480px;
      height: 480px;
      top: -100px;
      left: -80px;
      background: radial-gradient(circle, rgba(206, 172, 120, 0.45) 0%, rgba(206, 172, 120, 0) 70%);
      filter: blur(80px);
      animation: floatSlow 20s ease-in-out infinite alternate;
    }

    .orb-gold {
      width: 520px;
      height: 520px;
      bottom: -120px;
      right: -100px;
      background: radial-gradient(circle, rgba(45, 46, 49, 0.3) 0%, rgba(45, 46, 49, 0) 70%);
      filter: blur(90px);
      animation: floatSlow 24s ease-in-out infinite alternate-reverse;
    }

    .orb-neutral {
      width: 380px;
      height: 380px;
      top: 45%;
      left: 55%;
      background: radial-gradient(circle, rgba(121, 85, 72, 0.25) 0%, rgba(121, 85, 72, 0) 70%);
      filter: blur(85px);
      animation: floatSlow 18s ease-in-out infinite alternate;
    }

    @keyframes floatSlow {
      0% {
        transform: translate(0, 0) scale(1);
      }
      50% {
        transform: translate(30px, -25px) scale(1.08);
      }
      100% {
        transform: translate(-20px, 35px) scale(0.95);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .ambient-orb {
        animation: none;
      }
    }

    /* Tarjeta Glassmorphic */
    .auth-card {
      position: relative;
      z-index: 1;
      background: rgba(255, 255, 255, 0.88);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.8);
      border-radius: 20px;
      box-shadow:
        0 20px 45px -12px rgba(45, 46, 49, 0.12),
        0 0 0 1px rgba(255, 255, 255, 0.6) inset;
      padding: 3rem 2.5rem;
      max-width: 440px;
      width: 100%;
      text-align: center;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .brand-badge {
      display: inline-flex;
      margin-bottom: 1.25rem;
    }

    .brand-logo {
      width: 54px;
      height: 54px;
      filter: drop-shadow(0 6px 12px rgba(45, 46, 49, 0.15));
    }

    .auth-title {
      font-family: var(--fixup-font-heading);
      color: var(--fixup-color-primary);
      font-size: 2.1rem;
      margin: 0 0 0.5rem 0;
      letter-spacing: -0.02em;
    }

    .auth-tagline {
      color: #555555;
      font-size: 0.96rem;
      line-height: 1.45;
      margin: 0 0 1.5rem 0;
    }

    .ecosystem-tags {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1.75rem;
    }

    .eco-tag {
      background: #f1eee9;
      color: var(--fixup-color-primary);
      font-size: 0.78rem;
      font-weight: 600;
      padding: 0.35rem 0.75rem;
      border-radius: 20px;
      border: 1px solid rgba(206, 172, 120, 0.3);
    }

    .auth-error-alert {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      background-color: #fee2e2;
      color: #991b1b;
      border: 1px solid #f87171;
      border-radius: 10px;
      padding: 0.85rem 1rem;
      font-size: 0.88rem;
      margin-bottom: 1.5rem;
      text-align: left;
    }

    .alert-icon {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    .auth-btn-primary {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      gap: 0.65rem;
      background-color: var(--fixup-color-primary);
      color: #ffffff;
      border: none;
      border-radius: 12px;
      padding: 1rem 1.75rem;
      font-size: 1.05rem;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      box-shadow: 0 4px 14px rgba(45, 46, 49, 0.18);
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .auth-btn-primary:hover:not(:disabled) {
      background-color: var(--fixup-color-accent);
      color: var(--fixup-color-primary);
      box-shadow: 0 6px 20px rgba(206, 172, 120, 0.35);
      transform: translateY(-1px);
    }

    .auth-btn-primary:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: 0 2px 8px rgba(45, 46, 49, 0.15);
    }

    .auth-btn-primary:disabled {
      opacity: 0.65;
      cursor: not-allowed;
      transform: none;
    }

    .auth-icon {
      width: 20px;
      height: 20px;
    }

    .auth-footer {
      margin-top: 1.75rem;
      border-top: 1px solid rgba(45, 46, 49, 0.08);
      padding-top: 1.25rem;
    }

    .security-note {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      color: #777777;
      font-size: 0.8rem;
      margin: 0;
    }

    .shield-icon {
      width: 15px;
      height: 15px;
      color: var(--fixup-color-accent);
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
