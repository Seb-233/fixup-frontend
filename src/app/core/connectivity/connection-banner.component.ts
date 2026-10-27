import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { ConnectivityService } from './connectivity.service';

// Aviso fijo arriba mientras no hay conexión con el backend, y una confirmación breve al volver.
@Component({
  selector: 'app-connection-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="connection-banner-slot" aria-live="polite">
      @if (connectivity.state() === 'offline') {
        <div class="connection-banner alert alert-warning" role="status">
          <span class="connection-banner-text">
            <span class="spinner" aria-hidden="true"></span>
            <span><strong>Sin conexión.</strong> Reconectando automáticamente; lo que estabas viendo se actualiza solo al volver.</span>
          </span>
          <button type="button" class="btn btn-secondary" (click)="connectivity.probeNow()">Reintentar ahora</button>
        </div>
      } @else if (restored()) {
        <div class="connection-banner alert alert-success" role="status">
          <span><strong>Conexión restablecida.</strong></span>
        </div>
      }
    </div>
  `,
  styles: `
    .connection-banner-slot {
      position: fixed;
      inset: var(--s-3) var(--s-4) auto;
      z-index: 1000;
      display: flex;
      justify-content: center;
      pointer-events: none;
    }
    .connection-banner {
      align-items: center;
      flex-wrap: wrap;
      max-width: 40rem;
      box-shadow: 0 6px 24px rgb(0 0 0 / 18%);
      pointer-events: auto;
    }
    .connection-banner-text {
      display: flex;
      gap: var(--s-2);
      align-items: center;
    }
  `
})
export class ConnectionBannerComponent {
  readonly connectivity = inject(ConnectivityService);
  readonly restored = signal(false);

  constructor() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    inject(DestroyRef).onDestroy(() => clearTimeout(timer));
    effect(() => {
      if (this.connectivity.reconnections() === 0) return;
      this.restored.set(true);
      clearTimeout(timer);
      timer = setTimeout(() => this.restored.set(false), 4000);
    });
  }
}
