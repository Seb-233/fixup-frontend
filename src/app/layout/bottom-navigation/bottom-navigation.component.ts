import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-bottom-navigation',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="bottom-nav">
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="nav-item">
        <span class="nav-label">Inicio</span>
      </a>
      <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
        <span class="nav-label">Panel</span>
      </a>
      <a routerLink="/properties" routerLinkActive="active" class="nav-item">
        <span class="nav-label">Propiedades</span>
      </a>
      <a routerLink="/requests" routerLinkActive="active" class="nav-item">
        <span class="nav-label">Solicitudes</span>
      </a>
    </nav>
  `,
  styleUrls: ['./bottom-navigation.component.scss']
})
export class BottomNavigationComponent {}
