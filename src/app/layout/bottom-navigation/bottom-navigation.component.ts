import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { getNavigationForRole } from '../../core/navigation/role-navigation';

@Component({
  selector: 'app-bottom-navigation',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="bottom-nav">
      @for (item of visibleItems(); track item.path) {
        <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }" class="nav-item">
          <span class="nav-label">{{ item.label }}</span>
        </a>
      }
    </nav>
  `,
  styleUrls: ['./bottom-navigation.component.scss']
})
export class BottomNavigationComponent {
  private readonly userStore = inject(CurrentUserStore);

  readonly visibleItems = computed(() => {
    return getNavigationForRole(this.userStore.activeRole()).filter((item) => item.mobilePrimary);
  });
}
