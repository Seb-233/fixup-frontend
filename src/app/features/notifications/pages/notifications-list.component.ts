import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Notification,
  NotificationsService,
  NotificationType
} from '../../../api/notifications.service';

const TYPE_LABEL: Record<NotificationType, string> = {
  REPAIR_REQUEST_OPENED: 'Solicitud abierta',
  REPAIR_REQUEST_ASSIGNED: 'Técnico asignado',
  REPAIR_REQUEST_STARTED: 'Reparación iniciada',
  REPAIR_REQUEST_COMPLETED: 'Reparación completada',
  REPAIR_REQUEST_CANCELLED: 'Solicitud cancelada',
  REPAIR_REQUEST_ON_HOLD: 'En pausa',
  REPAIR_REQUEST_RESUMED: 'Reparación retomada',
  REPAIR_REQUEST_URGENCY_CHANGED: 'Urgencia modificada',
  SLA_WARNING: 'SLA próximo a vencer',
  SLA_BREACH: 'SLA vencido',
  NEW_QUOTATION: 'Nueva cotización',
  QUOTATION_ACCEPTED: 'Cotización aceptada',
  QUOTATION_REJECTED: 'Cotización rechazada',
  CONTRACT_CREATED: 'Contrato creado',
  CONTRACT_SIGNED: 'Contrato firmado',
  CONTRACT_RENEWED: 'Contrato renovado',
  CONTRACT_TERMINATED: 'Contrato terminado',
  CONTRACT_CANCELLED: 'Contrato cancelado',
  FIXER_VERIFICATION_SUBMITTED: 'Verificación enviada',
  FIXER_VERIFICATION_APPROVED: 'Verificación aprobada',
  FIXER_VERIFICATION_REJECTED: 'Verificación rechazada',
  PORTFOLIO_PIECE_APPROVED: 'Pieza aprobada',
  PORTFOLIO_PIECE_REJECTED: 'Pieza rechazada',
  PROPERTY_PUBLISHED: 'Inmueble publicado',
  PROPERTY_BATCH_PUBLISHED: 'Lote publicado',
  PROPERTY_UPDATED: 'Inmueble actualizado',
  PROPERTY_UNLISTED: 'Inmueble despublicado',
  GENERAL: 'General'
};

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="notifications">
      <header class="section-header">
        <div>
          <h1 class="title">Notificaciones</h1>
          <p class="subtitle">Historial de eventos del sistema. Las nuevas aparecen primero.</p>
        </div>
        <div class="actions">
          <label class="checkbox-inline">
            <input type="checkbox" [(ngModel)]="includeRead" (ngModelChange)="load()" />
            Incluir leídas
          </label>
          <button class="btn-secondary" (click)="load()" [disabled]="loading()">
            Refrescar
          </button>
          <button
            class="btn-primary"
            (click)="markAllRead()"
            [disabled]="loading() || notifications().length === 0"
          >
            Marcar todas leídas
          </button>
        </div>
      </header>

      @if (loading()) {
        <div class="loading-box">Cargando notificaciones...</div>
      } @else if (notifications().length === 0) {
        <div class="empty-state">
          <h3>Sin notificaciones aún</h3>
          <p>Aquí aparecerán los eventos importantes de tus inmuebles, solicitudes y contratos.</p>
        </div>
      } @else {
        <ul class="notifications-list">
          @for (n of notifications(); track n.id) {
            <li
              class="notification-card"
              [class.read]="n.isRead"
              [class.unread]="!n.isRead"
            >
              <div class="dot" aria-hidden="true"></div>
              <div class="main">
                <div class="row1">
                  <span class="type-tag">{{ labelFor(n.type) }}</span>
                  <span class="time">{{ formatRelative(n.createdAt) }}</span>
                </div>
                <h3 class="n-title">{{ n.title }}</h3>
                <p class="n-message">{{ n.message }}</p>
              </div>
              <div class="right">
                @if (!n.isRead) {
                  <button class="btn-ghost" (click)="markRead(n)">Marcar leída</button>
                }
              </div>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: [
    `
      .notifications { padding: 1.75rem; max-width: 1020px; }
      .section-header { display:flex; justify-content:space-between; align-items:flex-start; gap:1rem; margin-bottom:1.25rem; }
      .title { margin:0 0 .25rem; font-size: 1.5rem; }
      .subtitle { margin:0; color: var(--fixup-text-muted, #64748b); }
      .actions { display:flex; gap:.6rem; align-items:center; flex-wrap:wrap; }
      .checkbox-inline { display:flex; gap:.4rem; color: var(--fixup-text-muted, #475569); font-size:.9rem; }
      .btn-primary, .btn-secondary, .btn-ghost {
        border:0; border-radius:10px; padding:.6rem 1rem; font-weight:600; cursor:pointer;
      }
      .btn-primary { background: var(--fixup-color-primary, #4F46E5); color:white; }
      .btn-primary:disabled { opacity:.6; cursor:not-allowed; }
      .btn-secondary { background: var(--fixup-color-surface-2, #E2E8F0); color: #0f172a; }
      .btn-secondary:disabled { opacity:.6; }
      .btn-ghost { background:transparent; color: var(--fixup-color-primary, #4F46E5); }
      .loading-box, .empty-state {
        border:1px dashed var(--fixup-color-border, #cbd5e1); border-radius:14px;
        padding: 2.5rem; text-align:center; color: var(--fixup-text-muted, #64748b);
      }
      .empty-state h3 { margin:0 0 .5rem; color:#0f172a; }
      .notifications-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:.65rem; }
      .notification-card {
        display:grid; grid-template-columns: auto 1fr auto; gap:.9rem;
        padding:1rem 1.1rem; background:white; border:1px solid var(--fixup-color-border, #e2e8f0);
        border-radius:14px; box-shadow: 0 1px 2px rgba(15,23,42,.04);
      }
      .notification-card.unread { background: linear-gradient(180deg, #EEF2FF 0%, #FFFFFF 100%); }
      .notification-card.unread .dot { background: var(--fixup-color-primary, #6366f1); }
      .notification-card.read .dot { background: var(--fixup-color-border, #cbd5e1); }
      .dot { width:.55rem; height:.55rem; border-radius:999px; margin-top:.35rem; }
      .main .row1 { display:flex; gap:.5rem; align-items:center; margin-bottom:.25rem; }
      .type-tag {
        font-size:.72rem; text-transform:uppercase; letter-spacing:.04em;
        padding:.2rem .45rem; border-radius:999px; background:#eef2ff; color:#4338ca; font-weight:700;
      }
      .time { margin-left:auto; font-size:.78rem; color: var(--fixup-text-muted, #64748b); }
      .n-title { margin:.15rem 0 .25rem; font-size: 1rem; color:#0f172a; }
      .n-message { margin:0; color: var(--fixup-text-muted, #475569); line-height:1.45rem; }
      .right { align-self:center; }
    `
  ]
})
export class NotificationsListComponent implements OnInit {
  private readonly svc = inject(NotificationsService);

  readonly notifications = signal<Notification[]>([]);
  readonly loading = signal<boolean>(true);
  includeRead = true;

  ngOnInit(): void {
    this.load();
  }

  labelFor(t: NotificationType): string {
    return TYPE_LABEL[t] ?? t;
  }

  formatRelative(iso: string): string {
    try {
      const then = new Date(iso).getTime();
      const diff = Date.now() - then;
      const s = Math.floor(diff / 1000);
      if (s < 60) return 'hace unos segundos';
      const m = Math.floor(s / 60);
      if (m < 60) return `hace ${m} min`;
      const h = Math.floor(m / 60);
      if (h < 24) return `hace ${h} h`;
      const d = Math.floor(h / 24);
      if (d < 30) return `hace ${d} día${d === 1 ? '' : 's'}`;
      return new Date(iso).toLocaleDateString();
    } catch {
      return iso;
    }
  }

  load() {
    this.loading.set(true);
    this.svc.list({ includeRead: this.includeRead, limit: 100 }).subscribe({
      next: (items) => this.notifications.set(items),
      error: () => this.notifications.set([]),
      complete: () => this.loading.set(false)
    });
  }

  markRead(n: Notification) {
    this.svc.markAsRead(n.id).subscribe({
      next: () => {
        this.notifications.update((list) =>
          list.map((x) => (x.id === n.id ? { ...x, isRead: true, readAt: new Date().toISOString() } : x))
        );
      }
    });
  }

  markAllRead() {
    this.svc.markAllAsRead().subscribe({
      next: () => {
        this.notifications.update((list) =>
          list.map((x) => ({ ...x, isRead: true }))
        );
      }
    });
  }
}
