import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CurrentUserStore } from '../../core/auth/current-user.store';

interface NavItem {
  path: string;
  label: string;
  roles?: string[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar">
      <nav class="sidebar-nav">
        <ul class="nav-list">
          @for (item of visibleItems(); track item.path) {
            <li class="nav-item">
              <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }" class="nav-link">
                <span class="nav-label">{{ item.label }}</span>
              </a>
            </li>
          }
        </ul>
      </nav>
    </aside>
  `,
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {
  private readonly userStore = inject(CurrentUserStore);

  private readonly allItems: NavItem[] = [
    { path: '/dashboard', label: 'Panel Principal' },
    { path: '/properties', label: 'Propiedades', roles: ['OWNER', 'TENANT', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN'] },
    { path: '/fixers', label: 'Técnicos', roles: ['OWNER', 'FIXER', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN'] },
    { path: '/requests', label: 'Solicitudes', roles: ['OWNER', 'TENANT', 'FIXER', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN'] },
    { path: '/profile', label: 'Mi Perfil' }
  ];

  readonly visibleItems = computed(() => {
    const activeRole = this.userStore.activeRole();
    if (!activeRole) return [];
    return this.allItems.filter((item) => !item.roles || item.roles.includes(activeRole));
  });
}
