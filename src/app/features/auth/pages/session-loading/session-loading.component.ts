import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

// Estado accesible de carga y sincronización de sesión
@Component({
  selector: 'app-session-loading',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="loading-container" role="status" aria-live="polite" aria-busy="true">
      <div class="spinner-ring" aria-hidden="true"></div>
      <h2 class="loading-title">Sincronizando sesión</h2>
      <p class="loading-desc">Verificando credenciales y perfil de usuario con FixUp...</p>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 60vh;
      padding: 2rem;
    }
    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      max-width: 400px;
    }
    .spinner-ring {
      width: 48px;
      height: 48px;
      border: 4px solid #eaeaea;
      border-top-color: var(--fixup-color-accent);
      border-right-color: var(--fixup-color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 1.5rem;
    }
    .loading-title {
      font-family: var(--fixup-font-heading);
      color: var(--fixup-color-primary);
      font-size: 1.35rem;
      margin: 0 0 0.5rem 0;
    }
    .loading-desc {
      font-family: var(--fixup-font-body);
      color: #666666;
      font-size: 0.95rem;
      margin: 0;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class SessionLoadingComponent {}
