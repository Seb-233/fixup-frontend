import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DesktopShellComponent } from './layout/desktop-shell/desktop-shell.component';
import { MobileShellComponent } from './layout/mobile-shell/mobile-shell.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, DesktopShellComponent, MobileShellComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class App implements OnInit, OnDestroy {
  readonly title = signal('FixUp');
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
