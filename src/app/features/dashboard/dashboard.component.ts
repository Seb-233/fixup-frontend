import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CurrentUserStore } from '../../core/auth/current-user.store';

export type KpiType = 'properties' | 'requests' | 'fixers' | 'rating' | 'location' | 'work' | 'support';

export interface KpiMetric {
  label: string;
  value: string;
  trend: string;
  highlight: boolean;
  type: KpiType;
}

// Componente principal de aterrizaje del panel de FixUp tras autenticación
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="dashboard-container">
      <!-- Banner de bienvenida con resumen de sesión -->
      <header class="welcome-hero">
        <div class="hero-content">
          <div class="hero-greeting">
            <span class="greeting-pre">Panel de Control</span>
            <h1 class="greeting-title">
              ¡Bienvenido a FixUp{{ userStore.user()?.displayName ? ', ' + userStore.user()?.displayName : '' }}!
            </h1>
            <p class="greeting-subtitle">
              {{ roleSubtitle() }}
            </p>
          </div>

          <div class="hero-badges">
            <div class="role-badge">
              <span class="badge-dot"></span>
              <span>Rol: {{ roleLabel() }}</span>
            </div>

            @if (userStore.status() === 'PENDING') {
              <div class="status-badge pending">
                <span>Verificación en revisión</span>
              </div>
            } @else {
              <div class="status-badge active">
                <span>Cuenta activa</span>
              </div>
            }
          </div>
        </div>
      </header>

      <!-- Cuadrícula de métricas principales -->
      <section class="kpi-grid" aria-label="Resumen de actividad">
        @for (kpi of kpiMetrics(); track kpi.label) {
          <article class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">{{ kpi.label }}</span>
              <div class="kpi-icon-wrap" aria-hidden="true">
                @switch (kpi.type) {
                  @case ('properties') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5" />
                    </svg>
                  }
                  @case ('requests') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                  @case ('fixers') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                  }
                  @case ('location') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                  }
                  @case ('work') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                  }
                  @default {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  }
                }
              </div>
            </div>
            <div class="kpi-value">{{ kpi.value }}</div>
            <div class="kpi-footer">
              <span class="kpi-trend" [class.highlight]="kpi.highlight">{{ kpi.trend }}</span>
            </div>
          </article>
        }
      </section>

      <!-- Sección central: Acciones rápidas y Actividad reciente -->
      <div class="dashboard-columns">
        <!-- Acciones rápidas -->
        <section class="panel-section quick-actions-panel">
          <div class="section-header">
            <h2 class="section-title">Acciones Frecuentes</h2>
            <span class="section-hint">Accesos directos recomendados</span>
          </div>

          <div class="actions-list">
            <a [routerLink]="requestsPath()" class="action-card">
              <div class="action-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div class="action-text">
                <h3>Gestionar Solicitudes</h3>
                <p>Crea requerimientos de soporte o consulta el avance de trabajos en curso.</p>
              </div>
              <span class="action-arrow">→</span>
            </a>

            <a routerLink="/properties" class="action-card">
              <div class="action-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
              </div>
              <div class="action-text">
                <h3>Inmuebles y Propiedades</h3>
                <p>Explora inmuebles residenciales, fichas técnicas y ubicaciones.</p>
              </div>
              <span class="action-arrow">→</span>
            </a>

            <a routerLink="/fixers" class="action-card">
              <div class="action-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.07a4.5 4.5 0 004.486-6.32l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.32 4.486c.09.435.12 1.05-.07 1.742z" />
                </svg>
              </div>
              <div class="action-text">
                <h3>Directorio de Técnicos</h3>
                <p>Conecta con especialistas en plomería, electricidad, cerrajería y más.</p>
              </div>
              <span class="action-arrow">→</span>
            </a>
          </div>
        </section>

        <!-- Estado de la plataforma / Onboarding -->
        <section class="panel-section onboarding-panel">
          <div class="section-header">
            <h2 class="section-title">Primeros Pasos</h2>
            <span class="section-hint">Progreso de tu cuenta</span>
          </div>

          <div class="checklist">
            <div class="checklist-item done">
              <div class="check-icon">✓</div>
              <div class="check-content">
                <h4>Autenticación segura</h4>
                <p>Sesión vinculada exitosamente con Auth0.</p>
              </div>
            </div>

            <div class="checklist-item done">
              <div class="check-icon">✓</div>
              <div class="check-content">
                <h4>Rol asignado en el sistema</h4>
                <p>Operando bajo el perfil de {{ roleLabel() }}.</p>
              </div>
            </div>

            <div class="checklist-item next">
              <div class="check-icon dot">●</div>
              <div class="check-content">
                <h4>Explora tu primer módulo</h4>
                <p>Revisa solicitudes pendientes o actualiza los datos en tu perfil.</p>
                <a routerLink="/profile" class="checklist-cta">Ir a mi perfil</a>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
      padding: 0.5rem 0 2rem 0;
      max-width: 1200px;
      margin: 0 auto;
    }

    /* Hero de bienvenida */
    .welcome-hero {
      background: linear-gradient(135deg, #2D2E31 0%, #1f2023 100%);
      color: #ffffff;
      border-radius: 16px;
      padding: 2.25rem 2rem;
      box-shadow: 0 10px 30px -10px rgba(45, 46, 49, 0.25);
      position: relative;
      overflow: hidden;
    }

    .welcome-hero::after {
      content: '';
      position: absolute;
      top: -40px;
      right: -40px;
      width: 200px;
      height: 200px;
      background: radial-gradient(circle, rgba(206, 172, 120, 0.25) 0%, rgba(206, 172, 120, 0) 70%);
      border-radius: 50%;
      pointer-events: none;
    }

    .hero-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 1.5rem;
      position: relative;
      z-index: 1;
    }

    .hero-greeting {
      max-width: 680px;
    }

    .greeting-pre {
      display: inline-block;
      color: var(--fixup-color-accent);
      font-size: 0.82rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 0.4rem;
    }

    .greeting-title {
      font-family: var(--fixup-font-heading);
      color: #FFFFFF;
      font-size: 1.85rem;
      margin: 0 0 0.5rem 0;
      letter-spacing: -0.02em;
      line-height: 1.25;
    }

    .greeting-subtitle {
      color: #d1cfcb;
      font-size: 0.95rem;
      margin: 0;
      line-height: 1.45;
    }

    .hero-badges {
      display: flex;
      gap: 0.65rem;
      flex-wrap: wrap;
    }

    .role-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 20px;
      padding: 0.4rem 0.85rem;
      font-size: 0.82rem;
      font-weight: 600;
    }

    .badge-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background-color: var(--fixup-color-accent);
    }

    .status-badge {
      font-size: 0.82rem;
      font-weight: 600;
      padding: 0.4rem 0.85rem;
      border-radius: 20px;
    }

    .status-badge.active {
      background: rgba(16, 185, 129, 0.2);
      color: #34d399;
      border: 1px solid rgba(52, 211, 153, 0.3);
    }

    .status-badge.pending {
      background: rgba(245, 158, 11, 0.2);
      color: #fbbf24;
      border: 1px solid rgba(251, 191, 36, 0.3);
    }

    /* Grilla de Métricas KPI */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 1.25rem;
    }

    .kpi-card {
      background: #ffffff;
      border-radius: 12px;
      padding: 1.4rem 1.25rem;
      border: 1px solid rgba(154, 148, 141, 0.2);
      box-shadow: 0 2px 8px rgba(45, 46, 49, 0.04);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .kpi-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(45, 46, 49, 0.08);
    }

    .kpi-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.65rem;
    }

    .kpi-label {
      color: #666666;
      font-size: 0.85rem;
      font-weight: 600;
    }

    .kpi-icon-wrap {
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f8f6f2;
      border-radius: 8px;
      color: var(--fixup-color-primary);
    }

    .kpi-icon-wrap svg {
      width: 18px;
      height: 18px;
    }

    .kpi-value {
      font-family: var(--fixup-font-heading);
      font-size: 1.75rem;
      color: var(--fixup-color-primary);
      font-weight: 700;
      margin-bottom: 0.35rem;
      letter-spacing: -0.02em;
    }

    .kpi-footer {
      font-size: 0.78rem;
    }

    .kpi-trend {
      color: #888888;
    }

    .kpi-trend.highlight {
      color: #059669;
      font-weight: 600;
    }

    /* Distribución en dos columnas */
    .dashboard-columns {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 1.5rem;
    }

    @media (max-width: 900px) {
      .dashboard-columns {
        grid-template-columns: 1fr;
      }
    }

    .panel-section {
      background: #ffffff;
      border-radius: 14px;
      border: 1px solid rgba(154, 148, 141, 0.2);
      padding: 1.75rem;
      box-shadow: 0 2px 8px rgba(45, 46, 49, 0.03);
    }

    .section-header {
      margin-bottom: 1.25rem;
    }

    .section-title {
      font-family: var(--fixup-font-heading);
      color: var(--fixup-color-primary);
      font-size: 1.2rem;
      margin: 0 0 0.25rem 0;
    }

    .section-hint {
      color: #888888;
      font-size: 0.85rem;
    }

    /* Lista de acciones */
    .actions-list {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }

    .action-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem 1.15rem;
      border: 1px solid #e8e6e1;
      border-radius: 10px;
      text-decoration: none;
      color: inherit;
      transition: all 0.2s ease;
      background: #faf9f6;
    }

    .action-card:hover {
      border-color: var(--fixup-color-accent);
      background: #ffffff;
      box-shadow: 0 4px 12px rgba(206, 172, 120, 0.15);
      transform: translateX(3px);
    }

    .action-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--fixup-color-primary);
      border: 1px solid rgba(154, 148, 141, 0.2);
      flex-shrink: 0;
    }

    .action-icon svg {
      width: 22px;
      height: 22px;
    }

    .action-text {
      flex: 1;
      min-width: 0;
    }

    .action-text h3 {
      font-family: var(--fixup-font-heading);
      font-size: 0.98rem;
      color: var(--fixup-color-primary);
      margin: 0 0 0.2rem 0;
    }

    .action-text p {
      font-size: 0.82rem;
      color: #666666;
      margin: 0;
      line-height: 1.35;
    }

    .action-arrow {
      color: var(--fixup-color-accent);
      font-weight: 700;
      font-size: 1.1rem;
    }

    /* Lista de verificación / onboarding */
    .checklist {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .checklist-item {
      display: flex;
      align-items: flex-start;
      gap: 0.85rem;
      padding: 0.85rem;
      border-radius: 8px;
      background: #fafafa;
    }

    .checklist-item.done {
      border-left: 3px solid #10b981;
    }

    .checklist-item.next {
      border-left: 3px solid var(--fixup-color-accent);
      background: #fffdf9;
    }

    .check-icon {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      background: #10b981;
      color: #ffffff;
      flex-shrink: 0;
      margin-top: 0.15rem;
    }

    .check-icon.dot {
      background: var(--fixup-color-accent);
    }

    .check-content h4 {
      font-size: 0.9rem;
      color: var(--fixup-color-primary);
      margin: 0 0 0.2rem 0;
    }

    .check-content p {
      font-size: 0.8rem;
      color: #666666;
      margin: 0;
      line-height: 1.35;
    }

    .checklist-cta {
      display: inline-block;
      margin-top: 0.45rem;
      color: var(--fixup-color-accent);
      font-size: 0.8rem;
      font-weight: 700;
      text-decoration: underline;
    }
  `]
})
export class DashboardComponent {
  readonly userStore = inject(CurrentUserStore);

  readonly roleLabel = computed(() => {
    const role = this.userStore.activeRole();
    switch (role) {
      case 'OWNER':
        return 'Propietario';
      case 'TENANT':
        return 'Arrendatario';
      case 'FIXER':
        return 'Técnico Fixer';
      case 'REAL_ESTATE_MANAGER':
        return 'Administrador Inmobiliario';
      case 'PLATFORM_ADMIN':
        return 'Administrador de Plataforma';
      default:
        return 'Usuario';
    }
  });

  readonly requestsPath = computed(() => {
    return this.userStore.activeRole() === 'FIXER' ? '/requests/inbox' : '/requests';
  });

  readonly roleSubtitle = computed(() => {
    const role = this.userStore.activeRole();
    switch (role) {
      case 'OWNER':
        return 'Gestiona tus propiedades residenciales, publica mantenimientos y contrata a los mejores técnicos certificados.';
      case 'TENANT':
        return 'Consulta tus inmuebles autorizados, genera solicitudes de asistencia y sigue las reparaciones en tiempo real.';
      case 'FIXER':
        return 'Visualiza solicitudes de reparación en tu zona de cobertura, gestiona presupuestos y valida tus servicios.';
      default:
        return 'Accede a tus paneles de control, gestiona requerimientos y consulta el estado de tus servicios en FixUp.';
    }
  });

  readonly kpiMetrics = computed<KpiMetric[]>(() => {
    const role = this.userStore.activeRole();
    if (role === 'FIXER') {
      return [
        {
          label: 'Solicitudes en Zona',
          value: '8 activas',
          trend: 'Nuevas solicitudes disponibles',
          highlight: true,
          type: 'location'
        },
        {
          label: 'Trabajos Asignados',
          value: '3 en curso',
          trend: '1 programado hoy',
          highlight: false,
          type: 'requests'
        },
        {
          label: 'Calificación Fixer',
          value: '4.95 ★',
          trend: '18 valoraciones verificadas',
          highlight: true,
          type: 'work'
        },
        {
          label: 'Presupuestos Emitidos',
          value: '12 enviados',
          trend: '85% tasa de aceptación',
          highlight: false,
          type: 'rating'
        }
      ];
    } else if (role === 'TENANT') {
      return [
        {
          label: 'Inmueble Residencia',
          value: 'Torre Norte 402',
          trend: 'Arriendo vigente verificado',
          highlight: true,
          type: 'properties'
        },
        {
          label: 'Solicitud en Curso',
          value: '1 activa',
          trend: 'Técnico asignado para hoy',
          highlight: true,
          type: 'requests'
        },
        {
          label: 'Historial Resuelto',
          value: '5 casos',
          trend: '100% de conformidad',
          highlight: false,
          type: 'rating'
        },
        {
          label: 'Soporte FixUp',
          value: '24 / 7',
          trend: 'Atención prioritaria activa',
          highlight: false,
          type: 'support'
        }
      ];
    } else {
      // Default / OWNER
      return [
        {
          label: 'Propiedades Registradas',
          value: '4 inmuebles',
          trend: '+1 incorporado este mes',
          highlight: true,
          type: 'properties'
        },
        {
          label: 'Solicitudes Abiertas',
          value: '2 pendientes',
          trend: 'Cotizaciones en espera de aprobación',
          highlight: true,
          type: 'requests'
        },
        {
          label: 'Fixers Vinculados',
          value: '14 técnicos',
          trend: 'Todos con verificación documental',
          highlight: false,
          type: 'fixers'
        },
        {
          label: 'Satisfacción Global',
          value: '4.9 / 5.0',
          trend: 'Mantenimientos en tiempo récord',
          highlight: false,
          type: 'rating'
        }
      ];
    }
  });
}
