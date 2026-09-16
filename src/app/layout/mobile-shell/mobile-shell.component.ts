import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { TopbarComponent } from '../topbar/topbar.component';
import { BottomNavigationComponent } from '../bottom-navigation/bottom-navigation.component';

@Component({
  selector: 'app-mobile-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, TopbarComponent, BottomNavigationComponent],
  template: `
    <div class="mobile-layout">
      <app-topbar></app-topbar>
      <main class="mobile-content">
        <router-outlet></router-outlet>
      </main>
      <app-bottom-navigation></app-bottom-navigation>
    </div>
  `,
  styleUrls: ['./mobile-shell.component.scss']
})
export class MobileShellComponent {}
