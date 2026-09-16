import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { TopbarComponent } from '../topbar/topbar.component';
import { SidebarComponent } from '../sidebar/sidebar.component';

@Component({
  selector: 'app-desktop-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, TopbarComponent, SidebarComponent],
  template: `
    <div class="desktop-layout">
      <app-topbar></app-topbar>
      <div class="desktop-body">
        <app-sidebar></app-sidebar>
        <main class="desktop-content">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styleUrls: ['./desktop-shell.component.scss']
})
export class DesktopShellComponent {}
