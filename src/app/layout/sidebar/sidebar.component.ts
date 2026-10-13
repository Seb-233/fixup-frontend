import { Component, computed, inject, signal, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { getNavigationForRole } from '../../core/navigation/role-navigation';
import { FixerVerificationStore } from '../../features/fixers/pages/verification/fixer-verification.store';
import { NavIconComponent } from '../../shared/components/nav-icon/nav-icon.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, NavIconComponent],
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
                [routerLinkActiveOptions]="isExactNav(item.path)"
                [attr.title]="item.label"
                class="nav-link"
                (click)="onSelectNav(item.path)"
              >
                <!-- Íconos Vectoriales Propios según Ruta -->
                <span class="nav-icon-wrapper" aria-hidden="true">
                  <app-nav-icon [name]="item.icon" />
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

  isExactNav(path: string): { exact: boolean } {
    const items = this.visibleItems();
    const hasMoreSpecificSibling = items.some(
      (other) => other.path !== path && other.path.startsWith(path + '/')
    );
    return { exact: hasMoreSpecificSibling || path === '/dashboard' };
  }

  readonly activeIndex = computed<number>(() => {
    const items = this.visibleItems();
    const rawUrl = this.currentUrl();
    const url = rawUrl.split('?')[0].split('#')[0];

    let bestIndex = -1;
    let bestMatchLength = -1;

    items.forEach((item, index) => {
      const itemPath = item.path.split('?')[0];
      let matches = false;

      if (itemPath === '/dashboard') {
        matches = url === '/dashboard' || url === '/' || url.startsWith('/dashboard/');
      } else if (url === itemPath) {
        matches = true;
      } else if (url.startsWith(itemPath + '/')) {
        matches = true;
      }

      if (matches && itemPath.length > bestMatchLength) {
        bestMatchLength = itemPath.length;
        bestIndex = index;
      }
    });

    return bestIndex >= 0 ? bestIndex : 0;
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
