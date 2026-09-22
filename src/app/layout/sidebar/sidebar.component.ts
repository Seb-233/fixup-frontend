import { Component, computed, inject, signal, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { getNavigationForRole } from '../../core/navigation/role-navigation';
import { FixerVerificationStore } from '../../features/fixers/pages/verification/fixer-verification.store';

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

          @for (item of visibleItems(); track item.label; let idx = $index) {
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
                    @case ('quotations') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M6 3h12v18H6z" />
                        <path d="M9 8h6M9 12h6M9 16h3" />
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
                    @case ('verification') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 12l2 2 4-4" />
                        <circle cx="12" cy="12" r="9" />
                      </svg>
                    }
                    @case ('jobs') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="7" width="18" height="13" rx="2" />
                        <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 12h18" />
                      </svg>
                    }
                    @case ('earnings') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="5" width="18" height="14" rx="2" />
                        <path d="M7 12h.01M16 12h1M12 8v8M14 10c0-1-4-1-4 1s4 1 4 3-4 2-4 1" />
                      </svg>
                    }
                    @case ('portfolio') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="4" width="18" height="16" rx="2" />
                        <circle cx="8" cy="9" r="1.5" />
                        <path d="M3 17l5-5 4 4 3-3 6 6" />
                      </svg>
                    }
                    @case ('review') {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                        <rect x="9" y="3" width="6" height="4" rx="1" />
                        <path d="M9 14l2 2 4-4" />
                      </svg>
                    }
                  }
                </span>

                <span class="nav-label">{{ item.label }}</span>
                @if (item.requiresVerification) { <span class="nav-lock" role="img" aria-label="Requiere verificación" title="Completa tu verificación para acceder a esta funcionalidad"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg></span> }

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
  private readonly verificationStore = inject(FixerVerificationStore);
  private readonly router = inject(Router);

  // Estado de expansión y temporizador de 3 segundos
  readonly isExpanded = signal<boolean>(false);
  private collapseTimeout: ReturnType<typeof setTimeout> | null = null;

  // Ruta activa para controlar el deslizamiento fluido del sombreado
  readonly currentUrl = signal<string>(this.router.url);
  private readonly routerSubscription: Subscription;

  readonly visibleItems = computed(() => {
    return getNavigationForRole(this.userStore.activeRole(), this.verificationStore.verified());
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
