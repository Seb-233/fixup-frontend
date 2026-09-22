import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { getNavigationForRole, RoleNavigationItem } from '../../core/navigation/role-navigation';

interface DashboardAction extends RoleNavigationItem {
  description: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="dashboard-container">
      <header class="welcome-hero">
        <div>
          <span class="greeting-pre">Panel de control</span>
          <h1 class="greeting-title">
            Bienvenido a FixUp{{ userStore.user()?.displayName ? ', ' + userStore.user()?.displayName : '' }}
          </h1>
          <p class="greeting-subtitle">{{ roleSubtitle() }}</p>
        </div>
        <div class="hero-badges">
          <span class="role-badge">Rol: {{ roleLabel() }}</span>
          <span class="status-badge" [class.pending]="userStore.status() === 'PENDING'">
            {{ statusLabel() }}
          </span>
        </div>
      </header>

      <section class="panel-section" aria-labelledby="main-actions-title">
        <div class="section-header">
          <h2 id="main-actions-title" class="section-title">Acciones principales</h2>
          <p>Accede a las herramientas disponibles para tu perfil.</p>
        </div>
        <div class="actions-list">
          @for (action of primaryActions(); track action.label) {
            <a class="action-card" [routerLink]="action.path">
              <span class="action-icon" aria-hidden="true">?</span>
              <span>
                <strong>{{ action.label }}</strong>
                <small>{{ action.description }}</small>
              </span>
            </a>
          }
        </div>
      </section>

      @if (secondaryActions().length > 0) {
        <section class="panel-section secondary-panel" aria-labelledby="secondary-actions-title">
          <div class="section-header">
            <h2 id="secondary-actions-title" class="section-title">Más herramientas</h2>
            <p>Funciones disponibles desde tu cuenta FixUp.</p>
          </div>
          <div class="actions-list compact">
            @for (action of secondaryActions(); track action.path) {
              <a class="action-card" [routerLink]="action.path">
                <span class="action-icon" aria-hidden="true">?</span>
                <span>
                  <strong>{{ action.label }}</strong>
                  <small>{{ action.description }}</small>
                </span>
              </a>
            }
          </div>
        </section>
      }
    </div>
  `,
  styles: [`
    .dashboard-container { display: grid; gap: 1.5rem; max-width: 1120px; margin: 0 auto; padding: .5rem 0 2rem; }
    .welcome-hero { display: flex; justify-content: space-between; gap: 1.5rem; align-items: flex-start; padding: 2.25rem; border-radius: 1rem; color: #fff; background: linear-gradient(135deg, #2d2e31, #455966); }
    .greeting-pre { color: var(--fixup-color-accent, #ceac78); font-size: .8rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    .greeting-title { margin: .45rem 0; font-family: var(--fixup-font-heading); font-size: clamp(1.8rem, 3.5vw, 2.7rem); }
    .greeting-subtitle { max-width: 680px; margin: 0; color: #e2e0dc; line-height: 1.55; }
    .hero-badges { display: grid; gap: .6rem; flex-shrink: 0; }
    .role-badge, .status-badge { padding: .55rem .8rem; border-radius: 999px; background: rgba(255,255,255,.13); font-size: .85rem; font-weight: 700; }
    .status-badge.pending { color: #2d2e31; background: var(--fixup-color-accent, #ceac78); }
    .panel-section { padding: 1.5rem; border: 1px solid rgba(45,46,49,.11); border-radius: 1rem; background: #fff; }
    .section-header { margin-bottom: 1rem; }
    .section-title { margin: 0; font-family: var(--fixup-font-heading); color: var(--fixup-color-primary, #2d2e31); }
    .section-header p { margin: .4rem 0 0; color: #666; }
    .actions-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(235px, 1fr)); gap: .85rem; }
    .action-card { display: flex; gap: .8rem; align-items: flex-start; padding: 1rem; color: inherit; text-decoration: none; border: 1px solid rgba(45,46,49,.12); border-radius: .8rem; background: #fcfbf8; }
    .action-card:hover { border-color: var(--fixup-color-accent, #ceac78); }
    .action-card strong, .action-card small { display: block; }
    .action-card small { margin-top: .25rem; color: #666; line-height: 1.45; }
    .action-icon { display: grid; place-items: center; flex: 0 0 2rem; height: 2rem; border-radius: .55rem; color: #2d2e31; background: #eadfcf; font-weight: 800; }
    .secondary-panel { background: #f8f6f2; }
    @media (max-width: 720px) { .welcome-hero { flex-direction: column; padding: 1.5rem; } .hero-badges { grid-template-columns: 1fr 1fr; width: 100%; } }
  `]
})
export class DashboardComponent {
  readonly userStore = inject(CurrentUserStore);

  readonly roleLabel = computed(() => {
    switch (this.userStore.activeRole()) {
      case 'OWNER': return 'Propietario';
      case 'TENANT': return 'Arrendatario';
      case 'FIXER': return 'Técnico Fixer';
      case 'REAL_ESTATE_MANAGER': return 'Administrador inmobiliario';
      case 'PLATFORM_ADMIN': return 'Administrador de plataforma';
      default: return 'Usuario';
    }
  });

  readonly statusLabel = computed(() => {
    switch (this.userStore.status()) {
      case 'ACTIVE': return 'Cuenta activa';
      case 'PENDING': return 'Cuenta en proceso de validación';
      default: return this.userStore.status() ? `Estado: ${this.userStore.status()}` : 'Estado no disponible';
    }
  });

  readonly roleSubtitle = computed(() => {
    switch (this.userStore.activeRole()) {
      case 'OWNER': return 'Organiza tus propiedades y acompaña cada reparación desde su registro hasta sus solicitudes.';
      case 'FIXER': return 'Consulta solicitudes, cotizaciones, trabajos y las herramientas de tu actividad profesional.';
      case 'PLATFORM_ADMIN': return 'Administra los procesos de revisión de técnicos disponibles en la plataforma.';
      case 'TENANT': return 'Tu cuenta está activa. Las funciones disponibles dependen de los servicios habilitados para tu perfil.';
      case 'REAL_ESTATE_MANAGER': return 'Tu cuenta está activa. Las funciones disponibles dependen de los servicios habilitados para tu perfil.';
      default: return 'Consulta las herramientas habilitadas para tu cuenta.';
    }
  });

  private readonly navigationActions = computed<DashboardAction[]>(() =>
    getNavigationForRole(this.userStore.activeRole())
      .filter((item) => item.path !== '/dashboard')
      .map((item) => ({ ...item, description: this.actionDescription(item.path) }))
  );

  readonly primaryActions = computed<DashboardAction[]>(() => {
    const actions = this.navigationActions();
    if (this.userStore.activeRole() === 'OWNER') {
      return [
        actions.find((action) => action.path === '/properties')!,
        actions.find((action) => action.path === '/requests')!,
        {
          path: '/properties',
          label: 'Nueva reparación',
          icon: 'properties',
          mobilePrimary: false,
          description: 'Selecciona una de tus propiedades para reportar un problema.'
        },
        actions.find((action) => action.path === '/profile')!
      ];
    }
    return actions.filter((action) => action.mobilePrimary);
  });

  readonly secondaryActions = computed<DashboardAction[]>(() => {
    if (this.userStore.activeRole() !== 'FIXER') return [];
    return this.navigationActions().filter((action) => !action.mobilePrimary);
  });

  private actionDescription(path: string): string {
    const descriptions: Record<string, string> = {
      '/properties': 'Registra y consulta las propiedades de tu cuenta.',
      '/requests': 'Consulta las solicitudes de reparación que has creado.',
      '/requests/inbox': 'Revisa solicitudes disponibles para cotizar.',
      '/quotations/me': 'Consulta las cotizaciones que has enviado.',
      '/jobs/me': 'Da seguimiento a tus trabajos asignados.',
      '/payments/earnings': 'Consulta tus ingresos y transferencias solicitadas.',
      '/fixers/verification': 'Gestiona tu información de verificación.',
      '/fixers/portfolio': 'Administra las piezas de tu portafolio.',
      '/administration/fixer-review': 'Consulta y resuelve revisiones de técnicos.',
      '/profile': 'Consulta la información de tu cuenta.'
    };
    return descriptions[path] ?? 'Consulta esta herramienta disponible para tu cuenta.';
  }
}
