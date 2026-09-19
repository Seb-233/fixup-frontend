import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CurrentUserStore } from '../../core/auth/current-user.store';

interface MobileNavItem {
  path: string;
  label: string;
  roles?: string[];
}

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
    const activeRole = this.userStore.activeRole();
    if (!activeRole) return [];

    const items: MobileNavItem[] = [
      { path: '/dashboard', label: 'Panel' },
      { path: '/properties', label: 'Propiedades', roles: ['OWNER', 'TENANT', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN'] },
      { path: activeRole === 'FIXER' ? '/requests/inbox' : '/requests', label: 'Solicitudes', roles: ['OWNER', 'TENANT', 'FIXER', 'REAL_ESTATE_MANAGER'] },
      { path: '/profile', label: 'Perfil' }
    ];
    return items.filter((item) => !item.roles || item.roles.includes(activeRole));
  });
}
