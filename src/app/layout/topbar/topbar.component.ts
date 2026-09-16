import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="topbar">
      <div class="topbar-brand">
        <span class="brand-name">FixUp</span>
      </div>
      <div class="topbar-actions">
        <span class="user-greeting">Bienvenido a FixUp</span>
      </div>
    </header>
  `,
  styleUrls: ['./topbar.component.scss']
})
export class TopbarComponent {}
