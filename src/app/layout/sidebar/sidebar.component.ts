import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <aside class="sidebar">
      <nav class="sidebar-nav">
        <ul class="nav-list">
          <li class="nav-item">
            <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="nav-link">
              <span class="nav-label">Inicio</span>
            </a>
          </li>
          <li class="nav-item">
            <a routerLink="/dashboard" routerLinkActive="active" class="nav-link">
              <span class="nav-label">Panel Principal</span>
            </a>
          </li>
          <li class="nav-item">
            <a routerLink="/properties" routerLinkActive="active" class="nav-link">
              <span class="nav-label">Propiedades</span>
            </a>
          </li>
          <li class="nav-item">
            <a routerLink="/fixers" routerLinkActive="active" class="nav-link">
              <span class="nav-label">Técnicos</span>
            </a>
          </li>
          <li class="nav-item">
            <a routerLink="/requests" routerLinkActive="active" class="nav-link">
              <span class="nav-label">Solicitudes</span>
            </a>
          </li>
        </ul>
      </nav>
    </aside>
  `,
  styleUrls: ['./sidebar.component.scss']
})
export class SidebarComponent {}
