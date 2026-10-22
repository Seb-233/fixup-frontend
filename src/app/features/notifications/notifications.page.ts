import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationItem } from '../../core/notifications/notifications-api.service';
import { NotificationsStore } from '../../core/notifications/notifications.store';
import { IconComponent } from '../../shared/ui/icon.component';
import { AgoPipe } from '../../shared/ui/pipes';
import { EmptyStateComponent, ErrorStateComponent, LoadingComponent } from '../../shared/ui/states.component';

// Íconos por familia de aviso: el glifo dice de qué se trata antes de leer el título.
const ICON_BY_PREFIX: [string, string][] = [
  ['REQUEST_', 'wrench'],
  ['QUOTATION_', 'file'],
  ['JOB_', 'hammer'],
  ['VISIT_', 'calendar'],
  ['PAYMENT_', 'card'],
  ['RATING_', 'star'],
  ['FIXER_', 'shield'],
  ['PROPERTY_', 'building'],
  ['REMODELING_', 'hammer'],
  ['CONTRACT_', 'file'],
  ['CHAT_', 'chat']
];

@Component({
  selector: 'app-notifications-page',
  imports: [IconComponent, AgoPipe, LoadingComponent, ErrorStateComponent, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page page-narrow">
      <header class="page-header">
        <div>
          <h1>Notificaciones</h1>
          <p class="lede">{{ store.unreadCount() ? store.unreadCount() + ' sin leer.' : 'Estás al día.' }}</p>
        </div>
        <div class="actions">
          <button type="button" class="btn btn-secondary" (click)="store.markAllRead()" [disabled]="!store.unreadCount()"><app-icon name="check" />Marcar todas como leídas</button>
        </div>
      </header>

      <div class="tabs" role="tablist">
        <button type="button" role="tab" [attr.aria-selected]="!unreadOnly()" (click)="unreadOnly.set(false)">Todas</button>
        <button type="button" role="tab" [attr.aria-selected]="unreadOnly()" (click)="unreadOnly.set(true)">Sin leer <span class="count">{{ store.unreadCount() }}</span></button>
      </div>

      @if (store.loading() && !store.notifications().length) {
        <app-loading text="Cargando notificaciones…" />
      } @else if (store.error() && !store.notifications().length) {
        <app-error (retry)="store.forceRefresh()" />
      } @else if (visible().length) {
        <ul class="list panel feed">
          @for (n of visible(); track n.id) {
            <li>
              <button type="button" class="item" [class.unread]="!n.readAt" (click)="open(n)">
                <span class="icon" aria-hidden="true"><app-icon [name]="icon(n.type)" /></span>
                <span class="stack-sm grow">
                  <span class="row-title">{{ n.title }}@if (!n.readAt) {<span class="visually-hidden"> (sin leer)</span>}</span>
                  <span class="text-sm">{{ n.body }}</span>
                  <span class="text-xs text-muted">{{ n.createdAt | ago }}</span>
                </span>
                @if (!n.readAt) { <span class="unread-mark" aria-hidden="true"></span> }
              </button>
            </li>
          }
        </ul>
        @if (!unreadOnly()) {
          <div class="more"><button type="button" class="btn btn-ghost" (click)="store.loadMore()" [disabled]="store.loading()">Cargar anteriores</button></div>
        }
      } @else {
        <app-empty [title]="unreadOnly() ? 'No tienes notificaciones sin leer' : 'Aún no tienes notificaciones'" text="Aquí llegan cotizaciones, visitas, pagos y cambios en tus solicitudes." />
      }
    </div>
  `,
  styles: `
    .feed { padding: 0 var(--s-2); }
    .item { display: flex; gap: var(--s-3); align-items: flex-start; width: 100%; padding: var(--s-3) var(--s-2); border: 0; background: none; text-align: left; cursor: pointer; border-radius: var(--r-sm); }
    .item:hover { background: var(--surface-2); }
    .item:not(.unread) .row-title { font-weight: 500; }
    .icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: var(--surface-2); flex: none; }
    .unread .icon { background: var(--accent-soft); color: var(--accent-text); }
    .grow { flex: 1; min-width: 0; }
    .unread-mark { width: 8px; height: 8px; border-radius: 50%; background: var(--accent-text); margin-top: 8px; flex: none; }
    .more { display: flex; justify-content: center; }
  `
})
export class NotificationsPage implements OnInit {
  readonly store = inject(NotificationsStore);
  private readonly router = inject(Router);
  readonly unreadOnly = signal(false);
  readonly visible = computed(() => this.store.notifications().filter((n) => !this.unreadOnly() || !n.readAt));

  ngOnInit(): void {
    this.store.init();
  }

  icon(type: string): string {
    return ICON_BY_PREFIX.find(([prefix]) => type.startsWith(prefix))?.[1] ?? 'bell';
  }

  open(notification: NotificationItem): void {
    if (!notification.readAt) this.store.markOneRead(notification.id);
    const target = notification.navigateTo;
    if (target && target.startsWith('/') && !target.startsWith('//')) this.router.navigateByUrl(target);
  }
}
