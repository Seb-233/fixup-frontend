import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Role } from '../../core/auth/auth.types';
import { CurrentUserStore } from '../../core/auth/current-user.store';
import { getNavigationForRole } from '../../core/navigation/role-navigation';
import { NotificationsStore } from '../../core/notifications/notifications.store';
import { ThemeService } from '../../core/theme/theme.service';
import { FixerVerificationStore } from '../../features/fixers/pages/verification/fixer-verification.store';
import { ROLE_NAME, initials } from '../../shared/format';
import { IconComponent } from '../../shared/ui/icon.component';

// Marco de la aplicación privada. Tres estados según el ancho: barra lateral fija desde 1100 px,
// menú lateral desplegable entre 768 y 1100 px, y barra inferior con "Más" en el móvil.
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, IconComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShellComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly user = inject(CurrentUserStore);
  readonly notifications = inject(NotificationsStore);
  readonly theme = inject(ThemeService);
  private readonly verification = inject(FixerVerificationStore);

  readonly menuOpen = signal(false);
  readonly roleNames = ROLE_NAME;
  readonly nav = computed(() =>
    getNavigationForRole(this.user.activeRole(), this.user.activeRole() !== 'FIXER' || this.verification.verified())
  );
  readonly primary = computed(() => this.nav().filter((item) => item.mobilePrimary).slice(0, 4));
  readonly initials = computed(() => initials(this.user.user()?.displayName));
  readonly unread = computed(() => this.notifications.unreadCount());

  ngOnInit(): void {
    this.notifications.init();
    if (this.user.roles().includes('FIXER')) this.verification.ensureLoaded();
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.menuOpen.set(false));
  }

  @HostListener('document:keydown.escape')
  closeMenu(): void {
    this.menuOpen.set(false);
  }

  switchRole(role: string): void {
    this.user.setActiveRole(role as Role);
    if (role === 'FIXER') this.verification.ensureLoaded();
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    this.auth.logout().subscribe();
  }
}
