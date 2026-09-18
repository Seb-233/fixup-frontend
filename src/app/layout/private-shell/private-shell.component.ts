import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DesktopShellComponent } from '../desktop-shell/desktop-shell.component';
import { MobileShellComponent } from '../mobile-shell/mobile-shell.component';

// Layout privado que selecciona el shell responsive y aloja las rutas autenticadas
@Component({
  selector: 'app-private-shell',
  standalone: true,
  imports: [CommonModule, DesktopShellComponent, MobileShellComponent],
  template: `
    @if (isMobile()) {
      <app-mobile-shell></app-mobile-shell>
    } @else {
      <app-desktop-shell></app-desktop-shell>
    }
  `
})
export class PrivateShellComponent implements OnInit, OnDestroy {
  readonly isMobile = signal<boolean>(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  private resizeListener?: () => void;

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      this.resizeListener = () => {
        this.isMobile.set(window.innerWidth < 768);
      };
      window.addEventListener('resize', this.resizeListener);
    }
  }

  ngOnDestroy(): void {
    if (typeof window !== 'undefined' && this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }
  }
}
