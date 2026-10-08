import { Component, EventEmitter, Input, Output, computed, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular/lazy';
import { NotificationItem, NotificationType } from '../../../../core/notifications/notifications-api.service';

function iconForType(type: NotificationType): string {
  if (type.startsWith('REQUEST_')) return 'build-outline';
  if (type.startsWith('QUOTATION_')) return 'pricetag-outline';
  if (type.startsWith('PROPERTY_')) return 'business-outline';
  if (type.startsWith('CONTRACT_')) return 'document-text-outline';
  if (type.startsWith('CHAT_')) return 'chatbubbles-outline';
  if (type.startsWith('JOB_')) return 'construct-outline';
  if (type.includes('SLA')) return 'alert-circle-outline';
  return 'notifications-outline';
}

function avatarColorForType(type: NotificationType): string {
  if (type.startsWith('REQUEST_') || type.includes('SLA')) return 'danger';
  if (type.startsWith('QUOTATION_')) return 'success';
  if (type.startsWith('CONTRACT_')) return 'tertiary';
  if (type.startsWith('PROPERTY_')) return 'warning';
  if (type.startsWith('JOB_')) return 'primary';
  if (type.startsWith('CHAT_')) return 'secondary';
  return 'medium';
}

@Component({
  selector: 'app-notification-item',
  standalone: true,
  imports: [CommonModule, RouterModule, IonicModule],
  providers: [DatePipe],
  template: `
    <ion-item
      button
      detail="false"
      [routerLink]="notification.navigateTo || null"
      [class.unread]="!notification.readAt"
      (click)="onClick()"
    >
      <ion-avatar slot="start" [style]="'--ion-color:var(--ion-color-' + avatarColor() + ',#777);background:var(--ion-color-' + avatarColor() + ',#777)'">
        <ion-icon [name]="iconName()"></ion-icon>
      </ion-avatar>

      <ion-label class="notification-label">
        <h3 class="notification-title">
          {{ notification.title }}
        </h3>
        <p class="notification-body">
          {{ notification.body }}
        </p>
        <p class="notification-date">
          {{ relativeDate() }}
        </p>
      </ion-label>

      @if (!notification.readAt) {
        <ion-note slot="end" color="danger" class="new-tag">
          NUEVA
        </ion-note>
      }
    </ion-item>
  `,
  styles: [`
    .unread {
      --background: var(--ion-color-light-tint, #f8f9fa);
    }
    .unread .notification-title {
      font-weight: 600;
    }
    .notification-label {
      margin: 0.5rem 0;
    }
    .notification-title {
      margin: 0 0 0.25rem 0;
      font-size: 0.95rem;
      color: var(--ion-color-dark, #2d2e31);
      line-height: 1.3;
    }
    .notification-body {
      margin: 0 0 0.35rem 0;
      font-size: 0.85rem;
      color: var(--ion-color-medium, #6b6b6b);
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .notification-date {
      margin: 0;
      font-size: 0.75rem;
      color: var(--ion-color-medium-shade, #9a948d);
    }
    .new-tag {
      font-weight: 700;
      font-size: 0.7rem;
      margin-inline-start: 0.5rem;
    }
    ion-avatar {
      width: 42px !important;
      height: 42px !important;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;

      ion-icon {
        font-size: 20px;
        color: #fff;
      }
    }
  `]
})
export class NotificationItemComponent {
  private readonly datePipe = inject(DatePipe);

  @Input({ required: true }) notification!: NotificationItem;
  @Output() markRead = new EventEmitter<string>();

  readonly iconName = computed(() => iconForType(this.notification?.type));
  readonly avatarColor = computed(() => avatarColorForType(this.notification?.type));

  readonly relativeDate = computed(() => {
    const createdAt = this.notification?.createdAt;
    if (!createdAt) return '';
    const date = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffMin < 1) return 'Ahora mismo';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    if (diffHrs < 24) return `Hace ${diffHrs} h`;
    if (diffDays < 7) return `Hace ${diffDays} d`;
    return this.datePipe.transform(date, 'dd/MM/yyyy HH:mm') || '';
  });

  onClick(): void {
    if (!this.notification.readAt) {
      this.markRead.emit(this.notification.id);
    }
  }
}
