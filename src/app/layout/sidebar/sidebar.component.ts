import { Component, computed, inject, signal, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { CurrentUserStore } from '../../core/auth/current-user.store';

export interface NavItem {
  path: string;
  label: string;
  icon: 'dashboard' | 'properties' | 'fixers' | 'requests' | 'profile';
  badge?: string;
  roles?: string[];
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <aside
      class="sidebar floating-sidebar"
      [class.expanded]="isExpanded()"
    >
      <!-- Encabezado de la barra lateral -->
      <div class="sidebar-header">
        <div class="brand-container">
          <div class="brand-emblem" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M3 10.5L12 3l9 7.5v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 19.5v-9z" stroke-linejoin="round"/>
              <path d="M9 21v-7h6v7" stroke-linecap="round"/>
              <circle cx="17.5" cy="7.5" r="1.5" fill="var(--fixup-color-accent, #CEAC78)" stroke="none"/>
            </svg>
          </div>
          <div class="brand-text">
            <span class="brand-name">FixUp</span>
            <span class="brand-category">Gestión Inmobiliaria</span>
          </div>
        </div>
      </div>

      <div class="section-divider" aria-hidden="true"></div>

      <!-- Menú de Navegación Principal -->
      <nav class="sidebar-nav" aria-label="Navegación principal">
        <span class="nav-section-title">MÓDULOS DE PLATAFORMA</span>
        <ul class="nav-list">
          <!-- Sombreado deslizante que se mueve por las opciones hasta la seleccionada -->
          @if (visibleItems().length > 0) {
            <li
              class="sliding-highlight"
              aria-hidden="true"
              [style.transform]="'translateY(calc(' + activeIndex() + ' * (46px + 0.45rem)))'"
            ></li>
          }

          @for (item of visibleItems(); track item.path; let idx = $index) {
            <li class="nav-item">
              <a
                [routerLink]="item.path"
                routerLinkActive="active"
                [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }"
                [attr.title]="item.label"
                class="nav-link"
                (click)="onSelectNav(item.path)"
              >
                <!-- Íconos Vectoriales Propios según Ruta -->
                <span class="nav-icon-wrapper" aria-hidden="true">
                  @switch (item.icon) {
                    @case ('dashboard') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="7" height="9" rx="1.5" />
                        <rect x="14" y="3" width="7" height="5" rx="1.5" />
                        <rect x="14" y="12" width="7" height="9" rx="1.5" />
                        <rect x="3" y="16" width="7" height="5" rx="1.5" />
                      </svg>
                    }
                    @case ('properties') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 21h18M4 21V7l8-4 8 4v14" />
                        <path d="M9 10h2M13 10h2M9 14h2M13 14h2M10 21v-3a1 1 0 011-1h2a1 1 0 011 1v3" />
                      </svg>
                    }
                    @case ('notifications') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                      </svg>
                    }
                    @case ('fixers') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
                        <circle cx="17" cy="7" r="1" fill="currentColor" />
                      </svg>
                    }
                    @case ('requests') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                        <rect x="9" y="3" width="6" height="4" rx="1" />
                        <path d="M9 14l2 2 4-4" />
                      </svg>
                    }
                    @case ('profile') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M6 20v-1a6 6 0 0112 0v1" />
                      </svg>
                    }
                  }
                </span>

                <span class="nav-label">{{ item.label }}</span>

                @if (item.badge) {
                  <span class="item-badge">{{ item.badge }}</span>
                }
              </a>
            </li>
          }
        </ul>
      </nav>

      <!-- Pie de Barra Flotante con Estado de Sesión -->
      <div class="sidebar-footer">
        <div class="system-status-card">
          <div class="status-pulse-dot" aria-hidden="true"></div>
          <div class="status-texts">
            <span class="status-title">Conectado a FixUp</span>
            <span class="status-role">Rol: {{ userStore.activeRole() || 'Usuario' }}</span>
          </div>
        </div>
      </div>
    </aside>
  `,
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent implements OnDestroy {
  readonly userStore = inject(CurrentUserStore);
  private readonly router = inject(Router);

  // Estado de expansión y temporizador de 3 segundos
  readonly isExpanded = signal<boolean>(false);
  private collapseTimeout: ReturnType<typeof setTimeout> | null = null;

  // Ruta activa para controlar el deslizamiento fluido del sombreado
  readonly currentUrl = signal<string>(this.router.url);
  private readonly routerSubscription: Subscription;

  readonly visibleItems = computed(() => {
    const activeRole = this.userStore.activeRole();
    if (!activeRole) return [];

    const items: NavItem[] = [
      { path: '/dashboard', label: 'Panel Principal', icon: 'dashboard' },
      { path: '/properties', label: 'Propiedades', icon: 'properties', roles: ['OWNER', 'TENANT', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN'] },
      { path: '/fixers', label: 'Técnicos', icon: 'fixers', roles: ['OWNER', 'FIXER', 'REAL_ESTATE_MANAGER', 'PLATFORM_ADMIN'] },
      { path: activeRole === 'FIXER' ? '/requests/inbox' : '/requests', label: 'Solicitudes', icon: 'requests', roles: ['OWNER', 'TENANT', 'FIXER', 'REAL_ESTATE_MANAGER'] },
      { path: '/profile', label: 'Mi Perfil', icon: 'profile' }
    ];
    return items.filter((item) => !item.roles || item.roles.includes(activeRole));
  });

  constructor() {
    this.routerSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects || event.url);
      });
  }

  readonly activeIndex = computed<number>(() => {
    const items = this.visibleItems();
    const url = this.currentUrl();
    const index = items.findIndex((item) => {
      if (item.path === '/dashboard') {
        return url === '/dashboard' || url === '/' || url.startsWith('/dashboard');
      }
      return url.startsWith(item.path);
    });
    return index >= 0 ? index : 0;
  });

  @HostListener('mouseenter')
  onMouseEnter(): void {
    if (this.collapseTimeout) {
      clearTimeout(this.collapseTimeout);
      this.collapseTimeout = null;
    }
    this.isExpanded.set(true);
  }

  @HostListener('mouseleave')
  onMouseLeave(): void {
    if (this.collapseTimeout) {
      clearTimeout(this.collapseTimeout);
    }
    // Permanece abierto al menos 3 segundos antes de colapsar suavemente
    this.collapseTimeout = setTimeout(() => {
      this.isExpanded.set(false);
      this.collapseTimeout = null;
    }, 3000);
  }

  onSelectNav(path: string): void {
    // Inicia inmediatamente la animación del sombreado hacia la opción seleccionada
    this.currentUrl.set(path);
  }

  ngOnDestroy(): void {
    if (this.collapseTimeout) {
      clearTimeout(this.collapseTimeout);
    }
    this.routerSubscription.unsubscribe();
  }
}
