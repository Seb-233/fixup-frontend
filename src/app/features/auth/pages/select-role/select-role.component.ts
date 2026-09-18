import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../core/auth/auth.service';
import { CurrentUserStore } from '../../../../core/auth/current-user.store';
import { Role } from '../../../../core/auth/auth.types';

// Pantalla de selección inicial de rol para usuarios registrados sin roles previos
@Component({
  selector: 'app-select-role',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="role-selection-card">
      @if (availableRoles().length === 0) {
        <h1 class="title">Cuenta sin roles asignados</h1>
        <p class="subtitle">Tu cuenta está autenticada pero actualmente no cuenta con roles disponibles en el sistema.</p>

        <div class="warning-banner" role="alert">
          <strong>Aviso:</strong> No es posible seleccionar un rol no asignado por el backend. Por favor ponte en contacto con el administrador de la plataforma para obtener acceso.
        </div>

        <div class="actions">
          <button type="button" class="submit-btn" (click)="logout()">
            Cerrar sesión
          </button>
        </div>
      } @else {
        <h1 class="title">Selecciona tu rol en FixUp</h1>
        <p class="subtitle">Elige con cuál de tus roles asignados deseas operar en la plataforma.</p>

        @if (errorMessage()) {
          <div class="error-banner" role="alert">
            {{ errorMessage() }}
          </div>
        }

        <div class="roles-grid">
          @if (availableRoles().includes('OWNER')) {
            <button
              type="button"
              class="role-option"
              [class.selected]="selectedRole() === 'OWNER'"
              (click)="selectRole('OWNER')"
            >
              <div class="role-header">
                <h3>Propietario</h3>
                <span class="role-tag">Inmuebles</span>
              </div>
              <p>Publica y gestiona el mantenimiento de tus propiedades residenciales o comerciales.</p>
            </button>
          }

          @if (availableRoles().includes('TENANT')) {
            <button
              type="button"
              class="role-option"
              [class.selected]="selectedRole() === 'TENANT'"
              (click)="selectRole('TENANT')"
            >
              <div class="role-header">
                <h3>Arrendatario / Residente</h3>
                <span class="role-tag">Hogar</span>
              </div>
              <p>Solicita asistencia, reparaciones y seguimiento de solicitudes en tu vivienda.</p>
            </button>
          }

          @if (availableRoles().includes('FIXER')) {
            <button
              type="button"
              class="role-option"
              [class.selected]="selectedRole() === 'FIXER'"
              (click)="selectRole('FIXER')"
            >
              <div class="role-header">
                <h3>Técnico / Fixer</h3>
                <span class="role-tag">Servicios</span>
              </div>
              <p>Ofrece tus habilidades profesionales y servicios de reparación especializada.</p>
            </button>
          }
        </div>

        @if (selectedRole() === 'FIXER') {
          <div class="warning-banner" role="note">
            <strong>Aviso importante:</strong> Al operar como Técnico/Fixer, tu perfil requiere validación de credenciales para la asignación formal de servicios.
          </div>
        }

        <div class="actions">
          <button
            type="button"
            class="submit-btn"
            [disabled]="!selectedRole() || userStore.loading()"
            (click)="confirmSelection()"
          >
            {{ userStore.loading() ? 'Configurando cuenta...' : 'Continuar al panel' }}
          </button>
        </div>
      }
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
export class SelectRoleComponent {
  private readonly auth = inject(AuthService);
  readonly userStore = inject(CurrentUserStore);

  readonly availableRoles = this.userStore.roles;
  readonly selectedRole = signal<Role | null>(null);
  readonly errorMessage = signal<string | null>(null);

  selectRole(role: Role): void {
    this.selectedRole.set(role);
  }

  confirmSelection(): void {
    const role = this.selectedRole();
    if (!role) return;

    this.errorMessage.set(null);
    this.auth.selectRole(role);
  }

  logout(): void {
    this.auth.logout().subscribe();
  }
}
