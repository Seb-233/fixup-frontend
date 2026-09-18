import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';

// Pantalla de inicio de sesión con estética Glassmorphism, fondo ambiental multitono arquitectónico y Auth0
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="login-wrapper">
      <!-- 1. Rejilla Blueprint Arquitectónica de Precisión -->
      <div class="blueprint-grid" aria-hidden="true"></div>

      <!-- 2. Trazado Vectorial Axonométrico e Isométrico PropTech -->
      <svg class="architectural-blueprint" viewBox="0 0 1440 900" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="goldLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#CEAC78" stop-opacity="0.45" />
            <stop offset="100%" stop-color="#2D2E31" stop-opacity="0.08" />
          </linearGradient>
          <linearGradient id="tealLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#2B5366" stop-opacity="0.38" />
            <stop offset="100%" stop-color="#CEAC78" stop-opacity="0.10" />
          </linearGradient>
        </defs>
        <!-- Estructura axonométrica superior izquierda -->
        <g class="blueprint-iso-left" stroke="url(#goldLineGrad)" stroke-width="1.3">
          <path d="M140 160L250 95L360 160L250 225Z" />
          <path d="M140 160V290L250 355V225" />
          <path d="M360 160V290L250 355" />
          <line x1="90" y1="160" x2="90" y2="290" stroke-dasharray="4 4" />
          <line x1="80" y1="160" x2="100" y2="160" />
          <line x1="80" y1="290" x2="100" y2="290" />
          <circle cx="250" cy="95" r="3.5" fill="#CEAC78" />
          <circle cx="140" cy="160" r="3.5" fill="#CEAC78" />
          <circle cx="360" cy="160" r="3.5" fill="#CEAC78" />
          <circle cx="250" cy="355" r="3.5" fill="#CEAC78" />
        </g>
        <!-- Ejes de coordenadas y radio técnico inferior derecho -->
        <g class="blueprint-circle-right" stroke="url(#tealLineGrad)" stroke-width="1.3">
          <circle cx="1280" cy="740" r="160" stroke-dasharray="6 6" />
          <circle cx="1280" cy="740" r="100" />
          <circle cx="1280" cy="740" r="45" stroke-dasharray="3 3" />
          <line x1="1060" y1="740" x2="1440" y2="740" stroke-dasharray="4 4" />
          <line x1="1280" y1="520" x2="1280" y2="900" stroke-dasharray="4 4" />
          <rect x="1150" y="630" width="130" height="90" rx="6" stroke-dasharray="5 5" />
          <circle cx="1280" cy="740" r="4" fill="#2B5366" />
        </g>
      </svg>

      <!-- 3. Orbes de Luz Multitono con Profundidad y Movimiento Suave -->
      <div class="ambient-orb orb-gold" aria-hidden="true"></div>
      <div class="ambient-orb orb-slate" aria-hidden="true"></div>
      <div class="ambient-orb orb-teal" aria-hidden="true"></div>
      <div class="ambient-orb orb-bronze" aria-hidden="true"></div>

      <!-- 4. Tarjetas Flotantes de PropTech en el Fondo (Desktop) -->
      <div class="floating-cards-layer" aria-hidden="true">
        <!-- Tarjeta 1: Gestión de Inmuebles -->
        <div class="float-card float-card-top-left">
          <div class="float-card-icon icon-gold">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 21h18M3 10l9-7 9 7v11H3V10z" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M9 21V12h6v9" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="float-card-content">
            <span class="float-card-title">Gestión Inmobiliaria</span>
            <span class="float-card-stat">Inmuebles 100% verificados</span>
          </div>
        </div>

        <!-- Tarjeta 2: Red Fixer -->
        <div class="float-card float-card-top-right">
          <div class="float-card-icon icon-teal">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="float-card-content">
            <span class="float-card-title">Red Fixer Activa</span>
            <span class="float-card-stat">⭐ 4.9/5 Calificación</span>
          </div>
        </div>

        <!-- Tarjeta 3: Mantenimiento Ágil -->
        <div class="float-card float-card-bottom-left">
          <div class="float-card-icon icon-bronze">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="float-card-content">
            <span class="float-card-title">Mantenimiento 24/7</span>
            <span class="float-card-stat">⚡ Respuesta en tiempo real</span>
          </div>
        </div>

        <!-- Tarjeta 4: Cifrado Enterprise -->
        <div class="float-card float-card-bottom-right">
          <div class="float-card-icon icon-slate">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="float-card-content">
            <span class="float-card-title">Seguridad Enterprise</span>
            <span class="float-card-stat">🔒 Auth0 OpenID Connect</span>
          </div>
        </div>
      </div>

      <!-- 5. Tarjeta Glassmorphic Principal -->
      <main class="auth-card">
        <!-- Barra de acento dorada superior -->
        <div class="card-accent-bar" aria-hidden="true"></div>

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
      background: radial-gradient(ellipse at 50% 10%, #ffffff 0%, #f6f2ec 35%, #eae1d2 75%, #dbcfbd 100%);
      overflow: hidden;
    }

    /* 1. Rejilla Blueprint Arquitectónica */
    .blueprint-grid {
      position: absolute;
      inset: 0;
      background-image: 
        radial-gradient(circle at 50% 50%, rgba(206, 172, 120, 0.35) 1.5px, transparent 1.5px),
        linear-gradient(to right, rgba(45, 46, 49, 0.06) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(45, 46, 49, 0.06) 1px, transparent 1px);
      background-size: 32px 32px, 64px 64px, 64px 64px;
      pointer-events: none;
      z-index: 1;
      opacity: 0.9;
    }

    /* 2. Trazados Axonométricos Arquitectónicos */
    .architectural-blueprint {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2;
      opacity: 0.85;
    }

    .blueprint-iso-left {
      animation: blueprintPulse 12s ease-in-out infinite alternate;
    }

    .blueprint-circle-right {
      animation: blueprintRotate 28s linear infinite;
      transform-origin: 1280px 740px;
    }

    @keyframes blueprintPulse {
      0% { opacity: 0.7; transform: translateY(0); }
      100% { opacity: 1; transform: translateY(-10px); }
    }

    @keyframes blueprintRotate {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* 3. Orbes de Luz Multitono */
    .ambient-orb {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      z-index: 3;
      filter: blur(65px);
    }

    .orb-gold {
      width: 520px;
      height: 520px;
      top: -100px;
      left: -80px;
      background: radial-gradient(circle, rgba(206, 172, 120, 0.55) 0%, rgba(206, 172, 120, 0.08) 65%, transparent 100%);
      animation: floatOrbGold 20s ease-in-out infinite alternate;
    }

    .orb-slate {
      width: 540px;
      height: 540px;
      bottom: -120px;
      right: -100px;
      background: radial-gradient(circle, rgba(30, 34, 42, 0.28) 0%, rgba(30, 34, 42, 0.04) 65%, transparent 100%);
      animation: floatOrbSlate 24s ease-in-out infinite alternate;
    }

    .orb-teal {
      width: 440px;
      height: 440px;
      top: 15%;
      right: 8%;
      background: radial-gradient(circle, rgba(43, 83, 102, 0.35) 0%, rgba(43, 83, 102, 0.05) 65%, transparent 100%);
      animation: floatOrbTeal 22s ease-in-out infinite alternate;
    }

    .orb-bronze {
      width: 420px;
      height: 420px;
      bottom: 12%;
      left: 6%;
      background: radial-gradient(circle, rgba(194, 125, 68, 0.32) 0%, rgba(194, 125, 68, 0.04) 65%, transparent 100%);
      animation: floatOrbBronze 19s ease-in-out infinite alternate;
    }

    @keyframes floatOrbGold {
      0% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(40px, 30px) scale(1.06); }
      100% { transform: translate(-20px, 60px) scale(0.95); }
    }

    @keyframes floatOrbSlate {
      0% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(-50px, -40px) scale(1.08); }
      100% { transform: translate(30px, -60px) scale(0.94); }
    }

    @keyframes floatOrbTeal {
      0% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(-35px, 35px) scale(1.05); }
      100% { transform: translate(25px, -30px) scale(0.96); }
    }

    @keyframes floatOrbBronze {
      0% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(45px, -30px) scale(1.07); }
      100% { transform: translate(-30px, 20px) scale(0.93); }
    }

    /* 4. Tarjetas Flotantes de PropTech (Solo pantallas grandes >= 1080px) */
    .floating-cards-layer {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 4;
      display: none;
    }

    @media (min-width: 1080px) {
      .floating-cards-layer {
        display: block;
      }
    }

    .float-card {
      position: absolute;
      display: flex;
      align-items: center;
      gap: 0.85rem;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.9);
      border-radius: 14px;
      padding: 0.85rem 1.15rem;
      box-shadow: 
        0 14px 30px -8px rgba(45, 46, 49, 0.12),
        0 0 0 1px rgba(206, 172, 120, 0.25);
      transition: transform 0.4s ease;
    }

    .float-card-icon {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .float-card-icon svg {
      width: 20px;
      height: 20px;
    }

    .icon-gold {
      background: rgba(206, 172, 120, 0.18);
      color: #9c783c;
    }

    .icon-teal {
      background: rgba(43, 83, 102, 0.16);
      color: #2b5366;
    }

    .icon-bronze {
      background: rgba(194, 125, 68, 0.16);
      color: #a85f2b;
    }

    .icon-slate {
      background: rgba(45, 46, 49, 0.12);
      color: #2d2e31;
    }

    .float-card-content {
      display: flex;
      flex-direction: column;
    }

    .float-card-title {
      font-size: 0.85rem;
      font-weight: 700;
      color: #2d2e31;
      letter-spacing: -0.01em;
    }

    .float-card-stat {
      font-size: 0.74rem;
      color: #635f59;
      font-weight: 500;
    }

    .float-card-top-left {
      top: 14%;
      left: 7%;
      animation: floatCardSlow1 9s ease-in-out infinite alternate;
    }

    .float-card-top-right {
      top: 16%;
      right: 7%;
      animation: floatCardSlow2 11s ease-in-out infinite alternate;
    }

    .float-card-bottom-left {
      bottom: 14%;
      left: 8%;
      animation: floatCardSlow2 10s ease-in-out infinite alternate-reverse;
    }

    .float-card-bottom-right {
      bottom: 16%;
      right: 8%;
      animation: floatCardSlow1 12s ease-in-out infinite alternate-reverse;
    }

    @keyframes floatCardSlow1 {
      0% { transform: translateY(0) rotate(0deg); }
      100% { transform: translateY(-16px) rotate(1.2deg); }
    }

    @keyframes floatCardSlow2 {
      0% { transform: translateY(0) rotate(0deg); }
      100% { transform: translateY(18px) rotate(-1.2deg); }
    }

    /* 5. Tarjeta Glassmorphic Central */
    .auth-card {
      position: relative;
      z-index: 10;
      background: rgba(255, 255, 255, 0.88);
      backdrop-filter: blur(28px);
      -webkit-backdrop-filter: blur(28px);
      border: 1px solid rgba(255, 255, 255, 0.95);
      border-radius: 24px;
      box-shadow:
        0 25px 60px -15px rgba(45, 46, 49, 0.20),
        0 0 0 1px rgba(206, 172, 120, 0.32),
        inset 0 1px 2px rgba(255, 255, 255, 0.95);
      padding: 3.2rem 2.75rem;
      max-width: 450px;
      width: 100%;
      text-align: center;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s ease;
    }

    .card-accent-bar {
      position: absolute;
      top: 0;
      left: 12%;
      right: 12%;
      height: 3px;
      background: linear-gradient(90deg, transparent, #ceac78 30%, #e6c995 50%, #ceac78 70%, transparent);
      border-radius: 3px;
    }

    .brand-badge {
      display: inline-flex;
      margin-bottom: 1.25rem;
      transition: transform 0.25s ease;
    }

    .brand-badge:hover {
      transform: scale(1.05);
    }

    .brand-logo {
      width: 56px;
      height: 56px;
      filter: drop-shadow(0 8px 16px rgba(45, 46, 49, 0.18));
    }

    .auth-title {
      font-family: var(--fixup-font-heading);
      color: var(--fixup-color-primary);
      font-size: 2.25rem;
      margin: 0 0 0.45rem 0;
      letter-spacing: -0.02em;
    }

    .auth-tagline {
      color: #4a4a4d;
      font-size: 0.96rem;
      line-height: 1.48;
      margin: 0 0 1.6rem 0;
    }

    .ecosystem-tags {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 0.55rem;
      margin-bottom: 1.85rem;
    }

    .eco-tag {
      background: #f1ede6;
      color: var(--fixup-color-primary);
      font-size: 0.78rem;
      font-weight: 600;
      padding: 0.38rem 0.85rem;
      border-radius: 20px;
      border: 1px solid rgba(206, 172, 120, 0.4);
      transition: all 0.2s ease;
    }

    .eco-tag:hover {
      background: #e8e1d5;
      border-color: #ceac78;
    }

    .auth-error-alert {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      background-color: #fee2e2;
      color: #991b1b;
      border: 1px solid #f87171;
      border-radius: 12px;
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
      gap: 0.75rem;
      background: linear-gradient(135deg, #2d2e31 0%, #1e1f22 100%);
      color: #ffffff;
      border: 1px solid rgba(206, 172, 120, 0.35);
      border-radius: 14px;
      padding: 1.05rem 1.85rem;
      font-size: 1.05rem;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      box-shadow: 
        0 6px 18px rgba(45, 46, 49, 0.25),
        0 0 0 1px rgba(255, 255, 255, 0.1) inset;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .auth-btn-primary:hover:not(:disabled) {
      background: linear-gradient(135deg, #383a3e 0%, #24262a 100%);
      border-color: #ceac78;
      transform: translateY(-2px);
      box-shadow: 
        0 10px 24px rgba(45, 46, 49, 0.3),
        0 0 16px rgba(206, 172, 120, 0.25);
    }

    .auth-btn-primary:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: 0 4px 10px rgba(45, 46, 49, 0.2);
    }

    .auth-btn-primary:disabled {
      opacity: 0.65;
      cursor: not-allowed;
    }

    .auth-icon {
      width: 20px;
      height: 20px;
      color: var(--fixup-color-accent);
    }

    .auth-footer {
      margin-top: 1.85rem;
      padding-top: 1.25rem;
      border-top: 1px solid rgba(206, 172, 120, 0.25);
    }

    .security-note {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      color: #69655f;
      font-size: 0.8rem;
      margin: 0;
    }

    .shield-icon {
      width: 15px;
      height: 15px;
      color: var(--fixup-color-accent);
      flex-shrink: 0;
    }

    /* Reglas de Accesibilidad para Reducción de Movimiento */
    @media (prefers-reduced-motion: reduce) {
      .ambient-orb,
      .float-card,
      .blueprint-iso-left,
      .blueprint-circle-right {
        animation: none !important;
        transform: none !important;
      }
    }
  `]
})
export class LoginComponent {
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  /**
   * Sanitización rigurosa de returnUrl para prevenir ataques de open redirect.
   */
  readonly safeReturnUrl = computed<string>(() => {
    const rawUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (!rawUrl) {
      return '/dashboard';
    }

    const trimmed = rawUrl.trim();
    if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\') && !trimmed.includes(':')) {
      return trimmed;
    }

    return '/dashboard';
  });

  /**
   * Error retornado por Auth0 en queryParams.
   */
  readonly errorMessage = computed<string | null>(() => {
    return this.route.snapshot.queryParamMap.get('error_description') ??
           this.route.snapshot.queryParamMap.get('error');
  });

  login(): void {
    this.auth.loginWithRedirect(this.safeReturnUrl());
  }
}
