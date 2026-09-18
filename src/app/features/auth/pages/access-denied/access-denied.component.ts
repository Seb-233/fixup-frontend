import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

// Pantalla informativa de acceso denegado (HTTP 403 / falta de rol)
@Component({
  selector: 'app-access-denied',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="denied-card">
      <div class="icon-circle" aria-hidden="true">🔒</div>
      <h1 class="title">Acceso Denegado</h1>
      <p class="description">
        No cuentas con los permisos o el rol requerido para ver esta sección. Tu sesión permanece activa.
      </p>
      <div class="actions">
        <a routerLink="/" class="btn-primary">Volver al inicio</a>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 65vh;
      padding: 2rem 1rem;
    }
    .denied-card {
      background: #ffffff;
      border-radius: 12px;
      box-shadow: var(--fixup-shadow-md);
      padding: 3rem 2rem;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    .icon-circle {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }
    .title {
      font-family: var(--fixup-font-heading);
      color: var(--fixup-color-primary);
      font-size: 1.5rem;
      margin-bottom: 0.75rem;
    }
    .description {
      color: #666666;
      font-size: 0.95rem;
      line-height: 1.45;
      margin-bottom: 2rem;
    }
    .btn-primary {
      display: inline-block;
      background-color: var(--fixup-color-primary);
      color: #ffffff;
      text-decoration: none;
      border-radius: 8px;
      padding: 0.75rem 1.5rem;
      font-weight: 600;
      transition: background-color 0.2s;
    }
    .btn-primary:hover {
      background-color: var(--fixup-color-accent);
      color: var(--fixup-color-primary);
    }
  `]
})
export class AccessDeniedComponent {}
