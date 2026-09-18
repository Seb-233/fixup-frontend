import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { CurrentUserStore } from '../../../../core/auth/current-user.store';
import { INITIAL_ROLE_DETAILS, SelectableRole } from '../../../../core/auth/auth.types';

// Pantalla de selección inicial de rol para cuentas nuevas con diseño interactivo Glassmorphism
@Component({
  selector: 'app-select-role',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="onboarding-wrapper">
      <!-- Orbes difuminados de ambientación de marca -->
      <div class="ambient-orb orb-1" aria-hidden="true"></div>
      <div class="ambient-orb orb-2" aria-hidden="true"></div>

      <main class="role-selection-card">
        <!-- Indicador de progreso de incorporación -->
        <div class="step-indicator">
          <span class="step-badge">Paso 1 de 1 • Configuración Inicial</span>
        </div>

        <h1 class="title">Selecciona tu rol en FixUp</h1>
        <p class="subtitle">Personaliza las herramientas, accesos y paneles que verás en la plataforma.</p>

        @if (errorMessage()) {
          <div class="error-banner" role="alert">
            <svg class="icon-inline" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
            <span>{{ errorMessage() }}</span>
          </div>
        }

        <!-- Grilla de selección de roles con affordance enriquecida -->
        <div class="roles-grid" role="radiogroup" aria-label="Selección de rol">
          @for (option of roleOptions; track option.role) {
            <button
              type="button"
              class="role-option"
              [class.selected]="selectedRole() === option.role"
              (click)="selectRole(option.role)"
              role="radio"
              [attr.aria-checked]="selectedRole() === option.role"
            >
              <!-- Iconografía vectorial por rol -->
              <div class="role-avatar" [class.selected]="selectedRole() === option.role">
                @if (option.role === 'OWNER') {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                  </svg>
                } @else if (option.role === 'TENANT') {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                  </svg>
                } @else if (option.role === 'FIXER') {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.07a4.5 4.5 0 004.486-6.32l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.32 4.486c.09.435.12 1.05-.07 1.742z" />
                  </svg>
                }
              </div>

              <div class="role-content">
                <div class="role-header">
                  <h3 class="role-name">{{ option.name }}</h3>
                  <span class="role-tag">{{ option.tag }}</span>
                </div>
                <p class="role-desc">{{ option.description }}</p>

                <!-- Vista previa de beneficios al seleccionar -->
                @if (selectedRole() === option.role) {
                  <div class="role-perks-preview">
                    @if (option.role === 'OWNER') {
                      <span>✓ Publica inmuebles y recibe propuestas de técnicos certificados</span>
                    } @else if (option.role === 'TENANT') {
                      <span>✓ Reporta solicitudes con seguimiento en tiempo real y soporte ágil</span>
                    } @else if (option.role === 'FIXER') {
                      <span>✓ Conecta con propietarios y postúlate a solicitudes de tu especialidad</span>
                    }
                  </div>
                }
              </div>

              <!-- Indicador animado de selección -->
              <div class="radio-indicator" [class.checked]="selectedRole() === option.role" aria-hidden="true">
                @if (selectedRole() === option.role) {
                  <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2 6L5 9L10 3" />
                  </svg>
                }
              </div>
            </button>
          }
        </div>

        @if (selectedRole() === 'FIXER') {
          <div class="warning-banner" role="note">
            <svg class="icon-inline" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
            </svg>
            <div>
              <strong>Aviso de verificación:</strong> Al registrarte como Técnico/Fixer, tu estado de verificación comenzará como <strong>PENDING</strong> hasta la validación de tus credenciales profesionales.
            </div>
          </div>
        }

        <div class="actions">
          <button
            type="button"
            class="submit-btn"
            [disabled]="!selectedRole() || userStore.loading()"
            (click)="confirmSelection()"
          >
            <span>{{ userStore.loading() ? 'Guardando rol inicial...' : 'Continuar al panel principal' }}</span>
            <svg class="arrow-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>

          <button type="button" class="logout-link-btn" (click)="logout()">
            ¿Deseas iniciar con otra cuenta? Cerrar sesión
          </button>
        </div>
      </main>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      min-height: 100vh;
      width: 100%;
    }

    .onboarding-wrapper {
      position: relative;
      min-height: 100vh;
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 2rem 1.25rem;
      background: #faf8f5;
      overflow: hidden;
    }

    /* Orbes difuminados de fondo */
    .ambient-orb {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      z-index: 0;
      opacity: 0.65;
    }

    .orb-1 {
      width: 500px;
      height: 500px;
      top: -120px;
      right: -80px;
      background: radial-gradient(circle, rgba(206, 172, 120, 0.4) 0%, rgba(206, 172, 120, 0) 70%);
      filter: blur(90px);
      animation: floatSlow 22s ease-in-out infinite alternate;
    }

    .orb-2 {
      width: 450px;
      height: 450px;
      bottom: -100px;
      left: -80px;
      background: radial-gradient(circle, rgba(45, 46, 49, 0.25) 0%, rgba(45, 46, 49, 0) 70%);
      filter: blur(85px);
      animation: floatSlow 26s ease-in-out infinite alternate-reverse;
    }

    @keyframes floatSlow {
      0% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(25px, -20px) scale(1.05); }
      100% { transform: translate(-20px, 25px) scale(0.96); }
    }

    @media (prefers-reduced-motion: reduce) {
      .ambient-orb { animation: none; }
    }

    /* Tarjeta principal Glassmorphic */
    .role-selection-card {
      position: relative;
      z-index: 1;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.85);
      border-radius: 20px;
      box-shadow:
        0 20px 50px -12px rgba(45, 46, 49, 0.12),
        0 0 0 1px rgba(255, 255, 255, 0.6) inset;
      padding: 2.75rem 2.25rem;
      max-width: 660px;
      width: 100%;
    }

    .step-indicator {
      display: flex;
      justify-content: center;
      margin-bottom: 1rem;
    }

    .step-badge {
      background: #f0ede6;
      color: var(--fixup-color-primary);
      font-size: 0.78rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 0.35rem 0.85rem;
      border-radius: 20px;
      border: 1px solid rgba(206, 172, 120, 0.3);
    }

    .title {
      font-family: var(--fixup-font-heading);
      color: var(--fixup-color-primary);
      font-size: 1.85rem;
      margin: 0 0 0.5rem 0;
      text-align: center;
      letter-spacing: -0.02em;
    }

    .subtitle {
      color: #666666;
      font-size: 0.96rem;
      text-align: center;
      margin: 0 0 2rem 0;
      line-height: 1.45;
    }

    .roles-grid {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 1.75rem;
    }

    .role-option {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      background: #ffffff;
      border: 2px solid #e8e6e1;
      border-radius: 14px;
      padding: 1.25rem 1.4rem;
      text-align: left;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(45, 46, 49, 0.03);
      transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .role-option:hover {
      border-color: var(--fixup-color-neutral);
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(45, 46, 49, 0.08);
    }

    .role-option.selected {
      border-color: var(--fixup-color-accent);
      background: #fffdfa;
      box-shadow: 0 0 0 3px rgba(206, 172, 120, 0.25), 0 8px 20px rgba(45, 46, 49, 0.08);
    }

    .role-avatar {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: #f4f1eb;
      color: var(--fixup-color-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.2s ease;
    }

    .role-avatar svg {
      width: 26px;
      height: 26px;
    }

    .role-avatar.selected {
      background: var(--fixup-color-primary);
      color: var(--fixup-color-accent);
    }

    .role-content {
      flex: 1;
      min-width: 0;
    }

    .role-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.35rem;
    }

    .role-name {
      font-family: var(--fixup-font-heading);
      color: var(--fixup-color-primary);
      font-size: 1.12rem;
      margin: 0;
      font-weight: 700;
    }

    .role-tag {
      background: #f0ede6;
      color: var(--fixup-color-primary);
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.55rem;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .role-desc {
      margin: 0;
      color: #555555;
      font-size: 0.88rem;
      line-height: 1.4;
    }

    .role-perks-preview {
      margin-top: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px dashed rgba(206, 172, 120, 0.4);
      color: var(--fixup-color-earth-brown);
      font-size: 0.82rem;
      font-weight: 600;
    }

    .radio-indicator {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 2px solid #ccc7be;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: all 0.2s ease;
    }

    .radio-indicator.checked {
      border-color: var(--fixup-color-accent);
      background: var(--fixup-color-accent);
      color: #ffffff;
    }

    .radio-indicator svg {
      width: 14px;
      height: 14px;
    }

    .warning-banner {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      background-color: #fff9eb;
      border-left: 4px solid var(--fixup-color-accent);
      padding: 0.95rem 1.15rem;
      border-radius: 8px;
      font-size: 0.88rem;
      color: #664d03;
      margin-bottom: 1.75rem;
      line-height: 1.45;
    }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      background-color: #fde8e8;
      border-left: 4px solid #e02424;
      padding: 0.85rem 1rem;
      border-radius: 8px;
      font-size: 0.88rem;
      color: #9b1c1c;
      margin-bottom: 1.5rem;
    }

    .icon-inline {
      width: 20px;
      height: 20px;
      flex-shrink: 0;
    }

    .actions {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }

    .submit-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
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
      transition: all 0.22s ease;
    }

    .submit-btn:hover:not(:disabled) {
      background-color: var(--fixup-color-accent);
      color: var(--fixup-color-primary);
      box-shadow: 0 6px 20px rgba(206, 172, 120, 0.35);
      transform: translateY(-1px);
    }

    .submit-btn:active:not(:disabled) {
      transform: translateY(0);
    }

    .submit-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .arrow-icon {
      width: 18px;
      height: 18px;
    }

    .logout-link-btn {
      background: transparent;
      border: none;
      color: #777777;
      font-size: 0.85rem;
      cursor: pointer;
      text-decoration: underline;
      padding: 0.4rem;
      transition: color 0.2s ease;
    }

    .logout-link-btn:hover {
      color: var(--fixup-color-primary);
    }
  `]
})
export class SelectRoleComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly userStore = inject(CurrentUserStore);

  readonly roleOptions = INITIAL_ROLE_DETAILS;
  readonly selectedRole = signal<SelectableRole | null>(null);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    // 9. Un usuario con roles existentes no vuelve a seleccionar un rol inicial
    if (this.userStore.roles().length > 0) {
      this.router.navigate(['/dashboard'], { replaceUrl: true });
    }
  }

  selectRole(role: SelectableRole): void {
    this.selectedRole.set(role);
    this.errorMessage.set(null);
  }

  confirmSelection(): void {
    const role = this.selectedRole();
    if (!role) return;

    this.errorMessage.set(null);
    this.auth.selectInitialRole(role).subscribe({
      error: (err) => {
        const message =
          err?.error?.message ||
          err?.error?.code ||
          err?.message ||
          'No se pudo asignar el rol inicial';
        this.errorMessage.set(message);
      }
    });
  }

  logout(): void {
    this.auth.logout().subscribe();
  }
}
