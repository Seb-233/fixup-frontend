import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-placeholder',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="placeholder-container">
      <div class="placeholder-card">
        <h2 class="placeholder-title">{{ title || 'Módulo en preparación' }}</h2>
        <p class="placeholder-description">
          Esta sección está configurada dentro de la arquitectura base de FixUp y será implementada en las siguientes fases.
        </p>
      </div>
    </div>
  `,
  styles: [`
    .placeholder-container {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 280px;
      padding: 1.5rem;
    }
    .placeholder-card {
      background: #FFFFFF;
      border: 1px solid rgba(154, 148, 141, 0.25);
      border-radius: 8px;
      padding: 2rem;
      max-width: 540px;
      text-align: center;
      box-shadow: 0 4px 6px -1px rgba(45, 46, 49, 0.05);
    }
    .placeholder-title {
      font-family: var(--fixup-font-heading, 'Comfortaa', cursive);
      color: var(--fixup-color-primary, #2D2E31);
      margin-bottom: 0.75rem;
      font-size: 1.5rem;
    }
    .placeholder-description {
      font-family: var(--fixup-font-body, 'Inter', sans-serif);
      color: var(--fixup-color-neutral, #9A948D);
      font-size: 0.95rem;
      line-height: 1.5;
      margin: 0;
    }
  `]
})
export class PlaceholderComponent {
  @Input() title = '';
}
