import { Component, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RemodelingStore } from '../../services/remodeling.store';
import { remodelingProgressLabel } from '../../utils/remodeling-ui.helpers';

@Component({
  selector: 'app-remodeling-list',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe],
  template: `
    <section class="remodeling-page">
      <header class="page-header">
        <div class="header-content">
          <h1>Proyectos de Remodelación</h1>
          <p class="subtitle">Gestiona tus intervenciones integrales y coordina múltiples necesidades.</p>
        </div>
        <a routerLink="/remodelings/new" class="btn btn-primary" id="btn-new-remodeling">
          + Nueva remodelación
        </a>
      </header>

      @if (store.loading()) {
        <div class="state-container loading-state" role="status">
          <div class="spinner" aria-hidden="true"></div>
          <p>Cargando proyectos de remodelación...</p>
        </div>
      } @else if (store.error()) {
        <div class="state-container error-state" role="alert">
          <p class="error-msg">{{ store.error() }}</p>
          <button (click)="retry()" class="btn btn-secondary">Reintentar</button>
        </div>
      } @else if (store.projects().length === 0) {
        <div class="state-container empty-state">
          <div class="empty-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="icon-svg">
              <path d="M3 21h18M5 21V7l7-4 7 4v14" />
              <path d="M9 10h2M13 10h2M9 14h2M13 14h2" />
            </svg>
          </div>
          <h2>Aún no tienes proyectos de remodelación</h2>
          <p>Crea tu primer proyecto para coordinar diferentes oficios en un mismo inmueble.</p>
          <a routerLink="/remodelings/new" class="btn btn-primary">Nueva remodelación</a>
        </div>
      } @else {
        <div class="projects-grid">
          @for (project of store.projects(); track project.id) {
            <article class="project-card">
              <div class="card-header">
                <span class="status-badge" [attr.data-status]="project.progressStatus">
                  {{ progressLabel(project.progressStatus) }}
                </span>
                <span class="date">{{ project.createdAt | date:'mediumDate' }}</span>
              </div>

              <h2 class="card-title">{{ project.title }}</h2>
              <p class="property-ref">Inmueble: {{ project.propertyId }}</p>

              <div class="counters-row">
                <div class="counter-item">
                  <span class="counter-num">{{ project.requirementCount }}</span>
                  <span class="counter-label">Necesidades</span>
                </div>
                <div class="counter-item">
                  <span class="counter-num">{{ project.assignedCount }}</span>
                  <span class="counter-label">Asignadas</span>
                </div>
                <div class="counter-item">
                  <span class="counter-num">{{ project.completedCount }}</span>
                  <span class="counter-label">Completadas</span>
                </div>
              </div>

              <div class="card-footer">
                <a [routerLink]="['/remodelings', project.id]" class="view-link">
                  Ver detalle del proyecto →
                </a>
              </div>
            </article>
          }
        </div>
      }
    </section>
  `,
  styles: [`
    .remodeling-page {
      max-width: 1040px;
      margin: 0 auto;
      padding: 1.5rem 1rem 3rem;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .page-header h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: #2D2E31;
      margin: 0;
    }

    .subtitle {
      color: #7A756D;
      font-size: 0.9rem;
      margin: 0.25rem 0 0;
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
      transition: all 0.2s ease;
      border: 0;
    }

    .btn-primary {
      background: var(--fixup-color-primary, #2D2E31);
      color: #fff;
    }
    .btn-primary:hover {
      opacity: 0.92;
    }

    .btn-secondary {
      background: #f1ede6;
      color: #4A463F;
      border: 1px solid #ddd7cd;
    }

    .state-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3.5rem 1.5rem;
      background: #fff;
      border: 1px solid rgba(154, 148, 141, 0.2);
      border-radius: var(--fixup-radius-lg, 12px);
      text-align: center;
      gap: 1rem;
    }

    .empty-icon {
      width: 48px;
      height: 48px;
      color: var(--fixup-color-accent, #CEAC78);
    }
    .icon-svg {
      width: 100%;
      height: 100%;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid #e5e0d8;
      border-top-color: var(--fixup-color-accent, #CEAC78);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .projects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
      gap: 1.25rem;
    }

    .project-card {
      background: #fff;
      border: 1px solid rgba(154, 148, 141, 0.2);
      border-radius: var(--fixup-radius-lg, 12px);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }

    .project-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.6rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      background: #eef2ff;
      color: #3730a3;
    }

    .status-badge[data-status="OPEN"] {
      background: #ecfdf5;
      color: #065f46;
    }
    .status-badge[data-status="PARTIALLY_ASSIGNED"] {
      background: #eff6ff;
      color: #1e40af;
    }
    .status-badge[data-status="FULLY_ASSIGNED"] {
      background: #f5f3ff;
      color: #5b21b6;
    }
    .status-badge[data-status="PARTIALLY_COMPLETED"] {
      background: #fffbeb;
      color: #92400e;
    }
    .status-badge[data-status="COMPLETED"] {
      background: #f0fdf4;
      color: #166534;
    }

    .date {
      font-size: 0.8rem;
      color: #7A756D;
    }

    .card-title {
      font-size: 1.1rem;
      font-weight: 700;
      color: #2D2E31;
      margin: 0;
    }

    .property-ref {
      font-size: 0.82rem;
      color: #7A756D;
      margin: 0;
    }

    .counters-row {
      display: flex;
      gap: 0.75rem;
      background: #faf9f6;
      border: 1px solid #efece5;
      border-radius: 8px;
      padding: 0.65rem;
      justify-content: space-around;
      text-align: center;
    }

    .counter-item {
      display: flex;
      flex-direction: column;
    }

    .counter-num {
      font-size: 1.05rem;
      font-weight: 700;
      color: #2D2E31;
    }

    .counter-label {
      font-size: 0.72rem;
      color: #7A756D;
      text-transform: uppercase;
    }

    .card-footer {
      margin-top: auto;
      padding-top: 0.5rem;
      border-top: 1px solid #f2eee8;
    }

    .view-link {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--fixup-color-accent, #B9975B);
      text-decoration: none;
    }
    .view-link:hover {
      text-decoration: underline;
    }
  `]
})
export class RemodelingListComponent implements OnInit {
  readonly store = inject(RemodelingStore);

  ngOnInit(): void {
    this.store.loadProjects().subscribe();
  }

  retry(): void {
    this.store.loadProjects().subscribe();
  }

  progressLabel(status: string): string {
    return remodelingProgressLabel(status);
  }
}
