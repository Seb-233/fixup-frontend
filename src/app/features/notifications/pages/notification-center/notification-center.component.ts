import { Component, OnInit, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular/lazy';
import type { SegmentChangeEventDetail } from '@ionic/core';
import { NotificationsStore } from '../../../../core/notifications/notifications.store';
import { FilterNotificationPipe } from '../../../../core/notifications/filter-notification.pipe';
import { UnreadPipe } from '../../../../core/notifications/unread.pipe';
import { NotificationItemComponent } from '../../components/notification-item/notification-item.component';
import { PlaceholderComponent } from '../../../../shared/components/placeholder/placeholder.component';

const SEGMENT_TO_FILTER: Record<string, string> = {
  ALL: 'ALL',
  REQUEST: 'REQUEST',
  QUOTATION: 'QUOTATION',
  CONTRACT: 'CONTRACT',
  SLA: 'SLA',
  SYSTEM: 'SYSTEM'
};

const FILTER_TO_SEGMENT: Record<string, string> = {
  ALL: 'ALL',
  REQUEST: 'REQUEST',
  REQUEST_CREATED_URGENT: 'REQUEST',
  REQUEST_SLA_WARNING: 'SLA',
  REQUEST_SLA_BREACHED: 'SLA',
  QUOTATION: 'QUOTATION',
  QUOTATION_RECEIVED: 'QUOTATION',
  QUOTATION_ACCEPTED: 'QUOTATION',
  CONTRACT: 'CONTRACT',
  CONTRACT_CREATED: 'CONTRACT',
  CONTRACT_EXPIRING_30D: 'CONTRACT',
  CONTRACT_EXPIRING_7D: 'CONTRACT',
  CONTRACT_EXPIRED: 'CONTRACT',
  SLA: 'SLA',
  SYSTEM: 'SYSTEM',
  PROPERTY_PUBLISHED: 'SYSTEM',
  PROPERTY_BULK_FINISHED: 'SYSTEM',
  JOB_ASSIGNED: 'SYSTEM',
  CHAT_MESSAGE_RECEIVED: 'SYSTEM'
};

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonicModule,
    FilterNotificationPipe,
    UnreadPipe,
    NotificationItemComponent,
    PlaceholderComponent
  ],
  templateUrl: './notification-center.component.html',
  styleUrls: ['./notification-center.component.scss']
})
export class NotificationCenterComponent implements OnInit {
  readonly store = inject(NotificationsStore);
  private readonly router = inject(Router);

  readonly hasNotifications = computed(() => {
    const filtered = new FilterNotificationPipe().transform(
      this.store.notifications(),
      this.store.filterType()
    );
    const unreadFiltered = new UnreadPipe().transform(filtered, this.store.unreadOnly());
    return unreadFiltered.length > 0;
  });

  ngOnInit(): void {
    this.store.init();
  }

  segmentValueForFilter(filter: string): string {
    return FILTER_TO_SEGMENT[filter] ?? 'ALL';
  }

  onSegmentChange(ev: CustomEvent<SegmentChangeEventDetail>): void {
    const value = (ev.detail.value as string) || 'ALL';
    const filter = SEGMENT_TO_FILTER[value] ?? 'ALL';
    this.store.setFilter(filter);
  }

  onRefresh(ev: Event): void {
    const refresher = ev.target as HTMLIonRefresherElement;
    this.store.loadMore();
    setTimeout(() => refresher.complete(), 600);
  }

  onMarkRead(id: string): void {
    this.store.markOneRead(id);
  }

  onMarkAllRead(): void {
    this.store.markAllRead();
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }
}
