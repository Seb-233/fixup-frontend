import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { RemodelingStore } from '../../services/remodeling.store';
import {
  remodelingProgressLabel,
  specialtyLabel,
  requestStatusLabel,
  jobStatusLabel
} from '../../utils/remodeling-ui.helpers';

@Component({
  selector: 'app-remodeling-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="remodeling-detail-page">
      <header class="detail-header">
        <a routerLink="/remodelings" class="back-link">← Volver a mis remodelaciones</a>

        @if (store.selectedProject(); as project) {
          <div class="header-main">
            <div class="title-row">
              <h1>{{ project.title }}</h1>
              <span class="status-badge" [attr.data-status]="project.status">
                {{ progressLabel(project.status) }}
              </span>
            </div>
            <p class="property-line">Inmueble: <strong>{{ project.propertyId }}</strong></p>
            @if (project.description) {
              <p class="description-text">{{ project.description }}</p>
            }
          </div>

          <!-- RESUMEN DE PROGRESO DE SERVIDOR -->
          <div class="progress-summary-card">
            <div class="summary-metric">
              <span class="metric-num">{{ project.requirementCount }}</span>
              <span class="metric-label">Necesidades totales</span>
            </div>
            <div class="summary-metric">
              <span class="metric-num">{{ project.assignedCount }}</span>
              <span class="metric-label">Asignadas</span>
            </div>
            <div class="summary-metric">
              <span class="metric-num">{{ project.completedCount }}</span>
              <span class="metric-label">Completadas</span>
            </div>
          </div>
        }
      </header>

      @if (store.loading()) {
        <div class="state-card loading-state">
          <div class="spinner" aria-hidden="true"></div>
          <p>Cargando detalle del proyecto...</p>
        </div>
      } @else if (store.error()) {
        <div class="state-card error-state">
          <p>{{ store.error() }}</p>
          <button type="button" (click)="reload()" class="btn btn-secondary">Reintentar</button>
        </div>
      } @else if (store.selectedProject(); as project) {
        <section class="requirements-section">
          <h2>Necesidades y Oficios del Proyecto</h2>

          <div class="requirements-list">
            @for (req of project.requirements; track req.requirementId) {
              <article class="req-card">
                <div class="req-header">
                  <div class="req-badges">
                    <span class="position-badge">#{{ req.position + 1 }}</span>
                    <span class="specialty-badge">{{ specialty(req.specialty) }}</span>
                    <span class="req-status-badge" [attr.data-status]="req.requestStatus">
                      {{ statusLabel(req.requestStatus) }}
                    </span>
                  </div>
                  <span class="req-id">Solicitud: {{ req.requestId }}</span>
                </div>

                <div class="req-body">
                  @if (req.assignedFixerUserId) {
                    <div class="meta-row">
                      <span class="meta-label">Técnico asignado:</span>
                      <span class="meta-value">{{ req.assignedFixerUserId }}</span>
                    </div>
                  }

                  @if (req.jobStatus) {
                    <div class="meta-row">
                      <span class="meta-label">Estado del trabajo:</span>
                      <span class="meta-value">{{ jobLabel(req.jobStatus) }}</span>
                      @if (req.jobId) {
                        <span class="meta-sub">({{ req.jobId }})</span>
                      }
                    </div>
                  }
                </div>

                <!-- ENLACES A FLUJOS EXISTENTES (REUTILIZACIÓN) -->
                <footer class="req-actions">
                  <a
                    [routerLink]="['/requests', req.requestId]"
                    [queryParams]="{ from: 'remodelings', projectId: project.id }"
                    class="action-link"
                    [id]="'link-request-' + (req.position + 1)"
                  >
                    Ver solicitud →
                  </a>

                  <a
                    [routerLink]="['/quotations/request', req.requestId]"
                    [queryParams]="{ from: 'remodelings', projectId: project.id }"
                    class="action-link"
                    [id]="'link-quotations-' + (req.position + 1)"
                  >
                    Ver cotizaciones →
                  </a>

                  @if (canChat(req)) {
                    <a
                      [routerLink]="['/requests', req.requestId, 'messages']"
                      [queryParams]="{ from: 'remodelings', projectId: project.id }"
                      class="action-link chat-link"
                      [id]="'link-chat-' + (req.position + 1)"
                    >
                      Conversación →
                    </a>
                  }
                </footer>
              </article>
            }
          </div>
        </section>
      }
    </section>
  `,
  styles: [`
    .remodeling-detail-page {
      max-width: 960px;
      margin: 0 auto;
      padding: 1.5rem 1rem 3.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.75rem;
    }

    .detail-header {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .back-link {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--fixup-color-accent, #B9975B);
      text-decoration: none;
    }

    .header-main {
      background: #fff;
      border: 1px solid rgba(154, 148, 141, 0.2);
      border-radius: var(--fixup-radius-lg, 12px);
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .title-row h1 {
      font-size: 1.45rem;
      font-weight: 700;
      color: #2D2E31;
      margin: 0;
    }

    .status-badge {
      display: inline-block;
      padding: 0.3rem 0.75rem;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 600;
      background: #eef2ff;
      color: #3730a3;
    }
    .status-badge[data-status="OPEN"] { background: #ecfdf5; color: #065f46; }
    .status-badge[data-status="PARTIALLY_ASSIGNED"] { background: #eff6ff; color: #1e40af; }
    .status-badge[data-status="FULLY_ASSIGNED"] { background: #f5f3ff; color: #5b21b6; }
    .status-badge[data-status="PARTIALLY_COMPLETED"] { background: #fffbeb; color: #92400e; }
    .status-badge[data-status="COMPLETED"] { background: #f0fdf4; color: #166534; }

    .property-line {
      font-size: 0.88rem;
      color: #4A463F;
      margin: 0;
    }

    .description-text {
      font-size: 0.9rem;
      color: #555;
      margin: 0;
      line-height: 1.45;
    }

    .progress-summary-card {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      background: #faf9f6;
      border: 1px solid #efece5;
      border-radius: var(--fixup-radius-md, 8px);
      padding: 1.25rem;
      text-align: center;
    }

    .summary-metric {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .metric-num {
      font-size: 1.6rem;
      font-weight: 700;
      color: #2D2E31;
    }

    .metric-label {
      font-size: 0.78rem;
      text-transform: uppercase;
      color: #7A756D;
      font-weight: 600;
    }

    .state-card {
      background: #fff;
      border: 1px solid rgba(154, 148, 141, 0.2);
      border-radius: var(--fixup-radius-lg, 12px);
      padding: 3rem 1.5rem;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #e5e0d8;
      border-top-color: var(--fixup-color-accent, #CEAC78);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .requirements-section {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .requirements-section h2 {
      font-size: 1.2rem;
      font-weight: 700;
      color: #2D2E31;
      margin: 0;
    }

    .requirements-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .req-card {
      background: #fff;
      border: 1px solid rgba(154, 148, 141, 0.2);
      border-radius: var(--fixup-radius-md, 8px);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
    }

    .req-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.6rem;
    }

    .req-badges {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .position-badge {
      font-weight: 700;
      font-size: 0.82rem;
      background: #2D2E31;
      color: #fff;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
    }

    .specialty-badge {
      font-weight: 600;
      font-size: 0.8rem;
      background: #fef3c7;
      color: #92400e;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
    }

    .req-status-badge {
      font-weight: 600;
      font-size: 0.78rem;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      background: #f3f4f6;
      color: #374151;
    }
    .req-status-badge[data-status="OPEN"] { background: #ecfdf5; color: #065f46; }
    .req-status-badge[data-status="ASSIGNED"] { background: #eff6ff; color: #1e40af; }
    .req-status-badge[data-status="COMPLETED"] { background: #f0fdf4; color: #166534; }
    .req-status-badge[data-status="SLA_WARNING"] { background: #fffbeb; color: #92400e; }
    .req-status-badge[data-status="SLA_BREACHED"] { background: #fef2f2; color: #991b1b; }

    .req-id {
      font-size: 0.78rem;
      color: #888;
      font-family: monospace;
    }

    .req-body {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      font-size: 0.85rem;
    }

    .meta-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .meta-label {
      color: #666;
    }

    .meta-value {
      font-weight: 600;
      color: #2D2E31;
    }

    .meta-sub {
      color: #888;
      font-size: 0.78rem;
    }

    .req-actions {
      display: flex;
      align-items: center;
      gap: 1.25rem;
      padding-top: 0.75rem;
      border-top: 1px solid #f2eee8;
      flex-wrap: wrap;
    }

    .action-link {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--fixup-color-accent, #B9975B);
      text-decoration: none;
    }
    .action-link:hover {
      text-decoration: underline;
    }

    .chat-link {
      color: #2563eb;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.65rem 1.25rem;
      border-radius: var(--fixup-radius-md, 8px);
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      border: 0;
    }
    .btn-secondary {
      background: #f1ede6;
      color: #4A463F;
      border: 1px solid #ddd7cd;
    }

    @media (max-width: 640px) {
      .progress-summary-card {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class RemodelingDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly store = inject(RemodelingStore);

  ngOnInit(): void {
    const projectId = this.route.snapshot.paramMap.get('projectId');
    if (projectId) {
      this.store.loadDetail(projectId).subscribe();
    }
  }

  reload(): void {
    const projectId = this.route.snapshot.paramMap.get('projectId');
    if (projectId) {
      this.store.loadDetail(projectId).subscribe();
    }
  }

  progressLabel(status: string): string {
    return remodelingProgressLabel(status);
  }

  specialty(s: string): string {
    return specialtyLabel(s);
  }

  statusLabel(s: string): string {
    return requestStatusLabel(s);
  }

  jobLabel(j?: string | null): string {
    return jobStatusLabel(j);
  }

  canChat(req: { requestStatus: string; assignedFixerUserId?: string | null }): boolean {
    return req.requestStatus === 'ASSIGNED' || !!req.assignedFixerUserId;
  }
}
