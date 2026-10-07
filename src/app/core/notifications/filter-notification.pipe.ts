import { Pipe, PipeTransform } from '@angular/core';
import { NotificationItem, NotificationType } from './notifications-api.service';

const TYPE_GROUP_MAP: Record<string, NotificationType[]> = {
  REQUEST: ['REQUEST_CREATED_URGENT', 'REQUEST_SLA_WARNING', 'REQUEST_SLA_BREACHED'],
  QUOTATION: ['QUOTATION_RECEIVED', 'QUOTATION_ACCEPTED'],
  CONTRACT: [
    'CONTRACT_CREATED',
    'CONTRACT_EXPIRING_30D',
    'CONTRACT_EXPIRING_7D',
    'CONTRACT_EXPIRED'
  ],
  SLA: ['REQUEST_SLA_WARNING', 'REQUEST_SLA_BREACHED'],
  PROPERTY: ['PROPERTY_PUBLISHED', 'PROPERTY_BULK_FINISHED'],
  JOB: ['JOB_ASSIGNED'],
  CHAT: ['CHAT_MESSAGE_RECEIVED'],
  SYSTEM: [
    'PROPERTY_PUBLISHED',
    'PROPERTY_BULK_FINISHED',
    'JOB_ASSIGNED',
    'CHAT_MESSAGE_RECEIVED'
  ]
};

@Pipe({ name: 'filterNotification', standalone: true, pure: true })
export class FilterNotificationPipe implements PipeTransform {
  transform(
    items: NotificationItem[] | null | undefined,
    filter: NotificationType | 'ALL' | string
  ): NotificationItem[] {
    if (!items) return [];
    if (!filter || filter === 'ALL') return items;
    const group = TYPE_GROUP_MAP[filter];
    if (group) {
      return items.filter((n) => group.includes(n.type));
    }
    return items.filter((n) => n.type === filter);
  }
}
