import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { CurrentUserStore } from '../../../../core/auth/current-user.store';
import { INITIAL_ROLE_DETAILS, SelectableRole } from '../../../../core/auth/auth.types';

// Pantalla de selección inicial de rol para cuentas nuevas recién registradas
@Component({
  selector: 'app-select-role',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="role-selection-card">
      <h1 class="title">Selecciona tu rol en FixUp</h1>
      <p class="subtitle">Elige con cuál de los roles permitidos deseas iniciar tu experiencia en la plataforma.</p>

      @if (errorMessage()) {
        <div class="error-banner" role="alert">
          {{ errorMessage() }}
        </div>
      }

      <div class="roles-grid">
        @for (option of roleOptions; track option.role) {
          <button
            type="button"
            class="role-option"
            [class.selected]="selectedRole() === option.role"
            (click)="selectRole(option.role)"
          >
            <div class="role-header">
              <h3>{{ option.name }}</h3>
              <span class="role-tag">{{ option.tag }}</span>
            </div>
            <p>{{ option.description }}</p>
          </button>
        }
      </div>

      @if (selectedRole() === 'FIXER') {
        <div class="warning-banner" role="note">
          <strong>Aviso de verificación:</strong> Al registrarte como Técnico/Fixer, tu estado de verificación comenzará como PENDING hasta la validación de tus credenciales profesionales.
        </div>
      }

      <div class="actions">
        <button
          type="button"
          class="submit-btn"
          [disabled]="!selectedRole() || userStore.loading()"
          (click)="confirmSelection()"
        >
          {{ userStore.loading() ? 'Guardando rol inicial...' : 'Continuar al panel' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 75vh;
      padding: 2rem 1rem;
    }
    .role-selection-card {
      background: #ffffff;
      border-radius: 12px;
      box-shadow: var(--fixup-shadow-md);
      padding: 2.5rem 2rem;
      max-width: 640px;
      width: 100%;
    }
    .title {
      font-family: var(--fixup-font-heading);
      color: var(--fixup-color-primary);
      font-size: 1.6rem;
      margin: 0 0 0.5rem 0;
      text-align: center;
    }
    .subtitle {
      color: #666666;
      font-size: 0.95rem;
      text-align: center;
      margin: 0 0 2rem 0;
      line-height: 1.4;
    }
    .roles-grid {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .role-option {
      background: #fafafa;
      border: 2px solid #e2e2e2;
      border-radius: 10px;
      padding: 1.25rem;
      text-align: left;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .role-option:hover {
      border-color: var(--fixup-color-neutral);
      background: #ffffff;
    }
    .role-option.selected {
      border-color: var(--fixup-color-accent);
      background: #fffcf7;
      box-shadow: 0 0 0 2px rgba(206, 172, 120, 0.2);
    }
    .role-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.35rem;
    }
    .role-header h3 {
      font-family: var(--fixup-font-heading);
      color: var(--fixup-color-primary);
      font-size: 1.1rem;
      margin: 0;
    }
    .role-tag {
      background: #f0ede6;
      color: var(--fixup-color-primary);
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .role-option p {
      margin: 0;
      color: #555555;
      font-size: 0.88rem;
      line-height: 1.35;
    }
    .warning-banner {
      background-color: #fff9e6;
      border-left: 4px solid var(--fixup-color-accent);
      padding: 0.85rem 1rem;
      border-radius: 4px;
      font-size: 0.88rem;
      color: #5c4500;
      margin-bottom: 1.5rem;
      line-height: 1.4;
    }
    .error-banner {
      background-color: #fde8e8;
      border-left: 4px solid #e02424;
      padding: 0.75rem 1rem;
      border-radius: 4px;
      font-size: 0.88rem;
      color: #9b1c1c;
      margin-bottom: 1rem;
    }
    .actions {
      margin-top: 1rem;
    }
    .submit-btn {
      background-color: var(--fixup-color-primary);
      color: #ffffff;
      border: none;
      border-radius: 8px;
      padding: 0.9rem;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      width: 100%;
      transition: background-color 0.2s ease;
    }
    .submit-btn:hover:not(:disabled) {
      background-color: var(--fixup-color-accent);
      color: var(--fixup-color-primary);
    }
    .submit-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
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
