import { Pipe, PipeTransform } from '@angular/core';
import { NotificationItem } from './notifications-api.service';

@Pipe({ name: 'unread', standalone: true, pure: true })
export class UnreadPipe implements PipeTransform {
  transform(
    items: NotificationItem[] | null | undefined,
    onlyUnread: boolean
  ): NotificationItem[] {
    if (!items) return [];
    if (!onlyUnread) return items;
    return items.filter((n) => !n.readAt);
  }
}
