import { Component, HostListener, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  PaymentMethod,
  RepairRequestStatus,
  RequestDetailResponse,
  Specialty
} from '../../../../api/generated';
import {
  requestStatusLabel,
  specialtyLabel,
  paymentMethodLabel
} from '../../utils/request-ui.helpers';
import {
  OpenRequestExtended,
  URGENCY_LABELS,
  UrgencyLevel
} from '../../models/request-extensions';

export interface RemodelingContextBadge {
  projectTitle: string;
  position: number;
  projectId: string;
}

@Component({
  selector: 'app-request-drawer',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    @if (isOpen()) {
      <div
        class="drawer-backdrop"
        (click)="closeDrawer.emit()"
        aria-hidden="true"
      ></div>

      <aside
        class="drawer-panel"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="request()?.title ?? 'Detalle de la solicitud'"
        id="request-detail-drawer"
      >
        <div class="drawer-header">
          <div class="drawer-header-content">
            <span class="drawer-pretitle">Detalle contextual</span>
            <h2 class="drawer-title">{{ request()?.title }}</h2>
          </div>
          <button
            type="button"
            class="btn-close-drawer"
            id="btn-close-request-drawer"
            (click)="closeDrawer.emit()"
            aria-label="Cerrar detalle"
            title="Cerrar detalle (Esc)"
          >
            ✕
          </button>
        </div>

        @if (request(); as item) {
          <div class="drawer-body">
            <!-- Badges de contexto -->
            <div class="badges-row">
              <span class="chip-specialty">{{ specialtyText(item.specialty) }}</span>
              <span class="chip-status" [class.assigned]="item.status === 'ASSIGNED'" [class.completed]="item.status === 'COMPLETED'">
                {{ statusText(item.status) }}
              </span>
              @if (urgencyOf(item); as urg) {
                <span class="urgency-chip" [class]="'urgency-' + urg.toLowerCase()">
                  {{ urgencyText(urg) }}
                </span>
              }
              @if (remodelingInfo(); as rInfo) {
                <span class="remodeling-badge" id="remodeling-context-badge">
                  🏗️ Remodelación "{{ rInfo.projectTitle }}" · Necesidad #{{ rInfo.position }}
                </span>
              }
            </div>

            <!-- Descripción del daño -->
            <section class="drawer-section">
              <h3 class="section-label">Descripción del daño</h3>
              <p class="description-text">{{ item.description }}</p>
            </section>

            <!-- Forma de pago -->
            @if (item.paymentMethod) {
              <section class="drawer-section">
                <h3 class="section-label">Forma de pago acordada</h3>
                <span class="method-tag">{{ paymentMethodText(item.paymentMethod) }}</span>
              </section>
            }

            <!-- Fotografías adjuntas -->
            @if (item.photos && item.photos.length > 0) {
              <section class="drawer-section">
                <h3 class="section-label">Fotografías adjuntas ({{ item.photos.length }})</h3>
                <div class="photos-grid">
                  @for (photo of item.photos; track photo.readUrl) {
                    <div class="photo-thumb-card">
                      <img [src]="photo.readUrl" [alt]="item.title" class="thumb-img" loading="lazy" />
                    </div>
                  }
                </div>
              </section>
            }

            <!-- Acciones contextuales -->
            <div class="drawer-actions">
              @if (isOwner() && item.status !== 'COMPLETED') {
                <a
                  class="btn-cta-quotations"
                  id="drawer-btn-view-quotations"
                  [routerLink]="['/quotations/request', item.requestId]"
                  [queryParams]="remodelingInfo() ? { from: 'remodelings', projectId: remodelingInfo()?.projectId } : { from: 'requests' }"
                  (click)="closeDrawer.emit()"
                >
                  Ver ofertas recibidas →
                </a>
              }

              @if (item.status === 'ASSIGNED') {
                <a
                  class="btn-cta-chat"
                  id="drawer-btn-chat"
                  [routerLink]="['/requests', item.requestId, 'messages']"
                  [queryParams]="remodelingInfo() ? { from: 'remodelings', projectId: remodelingInfo()?.projectId } : { from: 'requests' }"
                  (click)="closeDrawer.emit()"
                >
                  Abrir conversación con el técnico →
                </a>
              }

              <a
                class="btn-full-page"
                [routerLink]="['/requests', item.requestId]"
                [queryParams]="remodelingInfo() ? { from: 'remodelings', projectId: remodelingInfo()?.projectId } : (isOwner() ? { from: 'requests' } : { from: 'inbox' })"
                (click)="closeDrawer.emit()"
              >
                Abrir en pantalla completa ↗
              </a>
            </div>
          </div>
        }
      </aside>
    }
  `,
  styles: [`
    :host {
      display: contents;
    }

    .drawer-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(45, 46, 49, 0.45);
      backdrop-filter: blur(2px);
      z-index: 1040;
      animation: fadeIn 0.2s ease-out;
    }

    .drawer-panel {
      position: fixed;
      top: 0;
      right: 0;
      width: 500px;
      max-width: 92vw;
      height: 100vh;
      background: #fff;
      box-shadow: -8px 0 32px rgba(0, 0, 0, 0.2);
      z-index: 1050;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideInRight {
      from { transform: translateX(100%); }
      to { transform: translateX(0); }
    }

    .drawer-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid #efece5;
      background: #faf9f6;
      position: sticky;
      top: 0;
      z-index: 2;
    }

    .drawer-header-content {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .drawer-pretitle {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #948b81;
      font-weight: 700;
    }

    .drawer-title {
      margin: 0;
      font-size: 1.2rem;
      font-family: var(--fixup-font-heading);
      color: var(--fixup-color-primary, #2D2E31);
      line-height: 1.3;
    }

    .btn-close-drawer {
      background: transparent;
      border: 1px solid #e5e0d8;
      border-radius: 8px;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1rem;
      color: #666;
      cursor: pointer;
      flex-shrink: 0;
      transition: all 0.15s ease;

      &:hover {
        background: #efece5;
        color: #2D2E31;
      }
    }

    .drawer-body {
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.35rem;
      flex: 1;
    }

    .badges-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }

    .chip-specialty {
      background: #fff;
      color: #78350f;
      border: 1px solid #fde68a;
      border-radius: 9999px;
      padding: 0.25rem 0.65rem;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .chip-status {
      border-radius: 9999px;
      padding: 0.25rem 0.65rem;
      font-size: 0.75rem;
      font-weight: 700;
      background: rgba(16, 185, 129, 0.15);
      color: #047857;

      &.assigned {
        background: rgba(154, 148, 141, 0.2);
        color: #57534e;
      }

      &.completed {
        background: #f1f5f9;
        color: #64748b;
      }
    }

    .urgency-chip {
      border-radius: 9999px;
      padding: 0.25rem 0.65rem;
      font-size: 0.75rem;
      font-weight: 700;

      &.urgency-low { background: #f0fdf4; color: #166534; }
      &.urgency-medium { background: #fefce8; color: #854d0e; }
      &.urgency-high { background: #fff7ed; color: #c2410c; }
      &.urgency-urgent { background: #fef2f2; color: #991b1b; }
    }

    .remodeling-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      background: #fdf4ff;
      color: #86198f;
      border: 1px solid #f5d0fe;
      border-radius: 9999px;
      padding: 0.25rem 0.75rem;
      font-size: 0.76rem;
      font-weight: 700;
    }

    .drawer-section {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
    }

    .section-label {
      margin: 0;
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #7A756D;
      font-weight: 700;
    }

    .description-text {
      margin: 0;
      font-size: 0.92rem;
      color: #4A463F;
      line-height: 1.55;
      white-space: pre-line;
      background: #faf9f6;
      border: 1px solid #efece5;
      border-radius: 8px;
      padding: 0.85rem 1rem;
    }

    .method-tag {
      font-size: 0.84rem;
      font-weight: 600;
      color: #1e293b;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 0.35rem 0.75rem;
      border-radius: 6px;
      align-self: flex-start;
    }

    .photos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: 0.65rem;
    }

    .photo-thumb-card {
      position: relative;
      border-radius: 8px;
      overflow: hidden;
      aspect-ratio: 1;
      border: 1px solid #e5e0d8;
      background: #f1f5f9;

      .thumb-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
    }

    .drawer-actions {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      margin-top: auto;
      padding-top: 1.25rem;
      border-top: 1px solid #efece5;
    }

    .btn-cta-quotations {
      display: flex;
      justify-content: center;
      align-items: center;
      background: var(--fixup-color-accent, #CEAC78);
      color: #fff;
      font-weight: 700;
      padding: 0.75rem 1.25rem;
      border-radius: var(--fixup-radius-md, 8px);
      text-decoration: none;
      font-size: 0.92rem;
      transition: background 0.15s ease;

      &:hover {
        background: #ba9862;
      }
    }

    .btn-cta-chat {
      display: flex;
      justify-content: center;
      align-items: center;
      background: var(--fixup-color-primary, #2D2E31);
      color: #fff;
      font-weight: 700;
      padding: 0.75rem 1.25rem;
      border-radius: var(--fixup-radius-md, 8px);
      text-decoration: none;
      font-size: 0.92rem;
      transition: background 0.15s ease;

      &:hover {
        background: #1f2023;
      }
    }

    .btn-full-page {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      color: #7A756D;
      font-size: 0.8rem;
      text-decoration: none;
      padding: 0.35rem;

      &:hover {
        color: #2D2E31;
        text-decoration: underline;
      }
    }

    @media (max-width: 640px) {
      .drawer-panel {
        width: 100%;
        max-width: 100%;
      }
    }
  `]
})
export class RequestDrawerComponent {
  readonly request = input<RequestDetailResponse | null>(null);
  readonly isOpen = computed(() => this.request() !== null);
  readonly remodelingInfo = input<RemodelingContextBadge | null>(null);
  readonly isOwner = input<boolean>(true);

  readonly closeDrawer = output<void>();

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.closeDrawer.emit();
    }
  }

  specialtyText(specialty?: Specialty): string {
    return specialty ? specialtyLabel(specialty) : '';
  }

  statusText(status?: RepairRequestStatus): string {
    return status ? requestStatusLabel(status) : '';
  }

  paymentMethodText(method?: PaymentMethod | string | null): string {
    return method ? paymentMethodLabel(method) : '';
  }

  urgencyOf(item: RequestDetailResponse): UrgencyLevel | null {
    return (item as unknown as OpenRequestExtended)?.urgencyLevel ?? null;
  }

  urgencyText(urgency: UrgencyLevel): string {
    return URGENCY_LABELS[urgency] || urgency;
  }
}
